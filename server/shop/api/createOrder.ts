import { z } from 'zod';
import { createEndpoint, AppError } from '../../core/endpoint';
import { db } from '../../core/db';
import { evaluateCode, getSettings } from '../lib/server/store';
import { CURRENCIES, getUsdPrice, markPaid, uniqueCryptoAmount, walletFor } from '../lib/server/crypto';
import { notifyCustomer } from '../lib/server/notify';

const bad = (m: string) => new AppError({ code: 'BAD_REQUEST', message: m, userFacingMessage: m });

export default createEndpoint({
  description: 'Places an order for the signed-in customer and quotes a crypto payment',
  authenticated: true,
  inputSchema: z.object({
    items: z.array(z.object({ productId: z.string(), quantity: z.number().int().min(1).max(50) })).min(1),
    customerName: z.string().min(1),
    address: z.object({
      street: z.string().min(3), city: z.string().min(1), postalCode: z.string().min(2), country: z.string().min(2),
    }),
    payCurrency: z.enum([...CURRENCIES, 'TEST']),
    discountCode: z.string().optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    const settings = await getSettings();
    const isTest = input.payCurrency === 'TEST';
    if (isTest && !settings?.testMode) throw bad('Test payments are turned off.');
    const address = isTest ? 'TEST' : walletFor(settings, input.payCurrency as (typeof CURRENCIES)[number]);
    if (!address) throw bad(`${input.payCurrency} payments are not available right now.`);
    const a = input.address;
    const shippingAddress = `${a.street}\n${a.postalCode} ${a.city}\n${a.country}`;

    const lines: { productId: string; name: string; price: number; quantity: number }[] = [];
    for (const it of input.items) {
      const p = await db.products.findOne({ id: it.productId });
      if (!p || !p.active) throw bad('An item in your cart is no longer available.');
      if (typeof p.stock === 'number' && p.stock < it.quantity) throw bad(`Only ${p.stock} of ${p.name} left in stock.`);
      lines.push({ productId: p.id, name: `${p.name}${p.size ? ` (${p.size})` : ''}`, price: typeof p.salePrice === 'number' && p.salePrice > 0 && p.salePrice < (p.price ?? 0) ? p.salePrice : p.price ?? 0, quantity: it.quantity });
    }
    const subtotal = Math.round(lines.reduce((a, l) => a + l.price * l.quantity, 0) * 100) / 100;

    let discount = 0;
    let code = '';
    let discountId = '';
    if (input.discountCode?.trim()) {
      try {
        const r = await evaluateCode(input.discountCode, subtotal);
        discount = r.discount;
        code = r.record.code ?? '';
        discountId = r.record.id;
      } catch (e) {
        throw bad((e as Error).message);
      }
    }
    const after = subtotal - discount;
    const free = settings?.freeShippingOver != null && after >= settings.freeShippingOver;
    const shipping = free ? 0 : settings?.shippingFee ?? 0;
    const total = Math.round((after + shipping) * 100) / 100;
    if (total <= 0) throw bad('Order total must be greater than zero.');

    const cryptoAmount = isTest ? total
      : uniqueCryptoAmount(total, await getUsdPrice(input.payCurrency as (typeof CURRENCIES)[number]), input.payCurrency as (typeof CURRENCIES)[number]);
    const orderNumber = `PL-${Date.now().toString(36).toUpperCase().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const orderId = crypto.randomUUID();
    const paymentExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await db.transaction(async (tx) => {
      for (const line of lines) {
        const { rows } = await tx.query(
          `UPDATE "Products"
             SET "stock" = CASE WHEN "stock" IS NULL THEN NULL ELSE "stock" - $2 END, "updatedAt" = now()
           WHERE "id" = $1 AND "active" IS TRUE AND ("stock" IS NULL OR "stock" >= $2)
           RETURNING "id"`,
          [line.productId, line.quantity],
        );
        if (!rows[0]) throw bad(`${line.name} is no longer available in that quantity.`);
      }

      if (discountId) {
        const { rows } = await tx.query(
          `UPDATE "DiscountCodes"
             SET "timesUsed" = COALESCE("timesUsed", 0) + 1, "updatedAt" = now()
           WHERE "id" = $1 AND "active" IS TRUE
             AND ("expiresAt" IS NULL OR "expiresAt" >= now())
             AND ("usageLimit" IS NULL OR COALESCE("timesUsed", 0) < "usageLimit")
             AND ("minimumOrder" IS NULL OR "minimumOrder" <= $2)
           RETURNING "id"`,
          [discountId, subtotal],
        );
        if (!rows[0]) throw bad('That discount code is no longer available.');
      }

      await tx.query(
        `INSERT INTO "Orders" (
          "id", "orderNumber", "customer", "customerEmail", "customerName", "shippingAddress",
          "streetAddress", "city", "postalCode", "country", "itemsJson", "subtotal", "discount",
          "shipping", "total", "discountCode", "discountCodeId", "payCurrency", "cryptoAmount", "payAddress",
          "paymentExpiresAt", "status"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'Awaiting Payment'
        )`,
        [
          orderId, orderNumber, context.user.id, context.user.email, input.customerName, shippingAddress,
          a.street, a.city, a.postalCode, a.country, JSON.stringify(lines), subtotal, discount,
          shipping, total, code, discountId || null, input.payCurrency, cryptoAmount, address, paymentExpiresAt,
        ],
      );
    });

    const order = await db.orders.findOne({ id: orderId });
    if (!order) throw new Error('Order creation failed');
    await notifyCustomer(order, 'order_confirmation',
      `Order ${orderNumber} placed. Send exactly ${cryptoAmount} ${input.payCurrency} to ${address}.`);
    if (isTest) await markPaid(order.id, `TEST-${orderNumber}`);
    return { id: order.id };
  },
});
