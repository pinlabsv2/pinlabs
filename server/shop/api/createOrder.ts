import { z } from 'zod';
import { createEndpoint, AppError } from '../../core/endpoint.js';
import { db } from '../../core/db.js';
import { enqueueOrderPlacedEmails } from '../../core/email/orderEmails.js';
import { getSettings } from '../lib/server/store.js';
import { CURRENCIES, getUsdPrice, markPaid, uniqueCryptoAmount, walletFor } from '../lib/server/crypto.js';

const bad = (message: string) => new AppError({ code: 'BAD_REQUEST', message, userFacingMessage: message });
const itemSchema = z.object({ productId: z.string(), variantId: z.string().nullable(), preorderExpectedShipAt: z.string().datetime().nullable().optional(), quantity: z.number().int().min(1).max(50) });

type LockedLine = {
  preorderEnabled: boolean;
  preorderExpectedShipAt: string | null;
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string;
  name: string;
  priceCents: number;
  quantity: number;
  shippingOptionId: string;
  shippingOptionName: string;
  shippingOptionPriceCents: number;
};

export default createEndpoint({
  description: 'Places an order for parent products or variants and quotes a crypto payment',
  authenticated: true,
  inputSchema: z.object({
    researchOnly: z.literal(true),
    confirmedMinimumAge: z.union([z.literal(18), z.literal(21)]),
    preorderAccepted: z.boolean().default(false),
    items: z.array(itemSchema).min(1).max(200),
    customerName: z.string().trim().min(1),
    address: z.object({ street: z.string().trim().min(3), city: z.string().trim().min(1), postalCode: z.string().trim().min(2), country: z.string().trim().min(2) }),
    payCurrency: z.enum([...CURRENCIES, 'TEST']),
    discountCode: z.string().optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    const aggregate = new Map<string, z.infer<typeof itemSchema>>();
    for (const item of input.items) {
      const key = `${item.productId}\u0000${item.variantId ?? ''}`;
      const quantity = (aggregate.get(key)?.quantity ?? 0) + item.quantity;
      if (quantity > 50) throw bad('A single item cannot have a quantity above 50.');
      aggregate.set(key, { ...item, quantity });
    }
    const requested = [...aggregate.values()].sort((a, b) => a.productId.localeCompare(b.productId) || (a.variantId ?? '').localeCompare(b.variantId ?? ''));
    const settings = await getSettings();
    if (input.confirmedMinimumAge < (settings?.minimumAge === 21 ? 21 : 18)) throw bad('Please confirm the current minimum age requirement.');
    const isTest = input.payCurrency === 'TEST';
    if (isTest && !settings?.testMode) throw bad('Test payments are turned off.');
    const payAddress = isTest ? 'TEST' : walletFor(settings, input.payCurrency as (typeof CURRENCIES)[number]);
    if (!payAddress) throw bad(`${input.payCurrency} payments are not available right now.`);
    const usdPrice = isTest ? 1 : await getUsdPrice(input.payCurrency as (typeof CURRENCIES)[number]);
    const address = input.address;
    const shippingAddress = `${address.street}\n${address.postalCode} ${address.city}\n${address.country}`;
    const orderNumber = `PL-${Date.now().toString(36).toUpperCase().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const orderId = crypto.randomUUID();
    const paymentExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await db.transaction(async (tx) => {
      const productIds = [...new Set(requested.map((item) => item.productId))].sort();
      const { rows: productRows } = await tx.query(`SELECT * FROM "Products" WHERE "id" = ANY($1::text[]) ORDER BY "id" FOR UPDATE`, [productIds]);
      const products = new Map(productRows.map((row) => [String(row.id), row]));
      if (products.size !== productIds.length) throw bad('An item in your cart is no longer available.');

      const requestedVariantIds = [...new Set(requested.flatMap((item) => item.variantId ? [item.variantId] : []))].sort();
      const { rows: variantRows } = requestedVariantIds.length
        ? await tx.query(`SELECT * FROM "ProductVariants" WHERE "id" = ANY($1::text[]) ORDER BY "id" FOR UPDATE`, [requestedVariantIds])
        : { rows: [] };
      const variants = new Map(variantRows.map((row) => [String(row.id), row]));
      if (variants.size !== requestedVariantIds.length) throw bad('A selected variant is no longer available.');

      const pending = requested.map((item) => {
        const product = products.get(item.productId)!;
        if (product.active !== true) throw bad(`${String(product.name ?? 'An item')} is no longer available.`);
        const hasVariants = product.hasVariants === true;
        const shippingScope = product.shippingScope === 'variant' ? 'variant' : 'product';
        if (hasVariants && !item.variantId) throw bad(`Choose a variant for ${String(product.name ?? 'this product')}.`);
        if (!hasVariants && item.variantId) throw bad(`${String(product.name ?? 'This product')} no longer uses variants.`);
        const variant = item.variantId ? variants.get(item.variantId) : undefined;
        if (variant && (String(variant.productId) !== item.productId || variant.active !== true)) throw bad('A selected variant is no longer available.');
        const price = variant ? Number(variant.price ?? 0) : Number(product.price ?? 0);
        const rawSale = variant ? variant.salePrice : product.salePrice;
        const salePrice = typeof rawSale === 'number' && rawSale > 0 && rawSale < price ? rawSale : null;
        const stock = variant ? variant.stock : product.stock;
        const preorderEnabled = product.preorderEnabled === true || variant?.preorderEnabled === true;
        const rawDate = product.preorderEnabled === true ? product.preorderExpectedShipAt : variant?.preorderExpectedShipAt;
        const preorderExpectedShipAt = preorderEnabled && rawDate ? new Date(rawDate).toISOString() : null;
        if (preorderEnabled && (!preorderExpectedShipAt || Date.parse(preorderExpectedShipAt) <= Date.now() || stock == null)) throw bad('Preorder availability needs updating. Please contact support.');
        if (preorderEnabled && item.preorderExpectedShipAt !== preorderExpectedShipAt) throw bad('The preorder dispatch date changed. Refresh your cart and accept the new date.');
        if (preorderEnabled && !input.preorderAccepted) throw bad('Accept the preorder dispatch dates and payment terms before ordering.');
        if (typeof stock === 'number' && stock < item.quantity) throw bad(`Only ${stock} of ${String(variant?.name ?? product.name ?? 'this item')} remain in stock.`);
        const shippingOptionId = shippingScope === 'variant' ? variant?.shippingOptionId : product.shippingOptionId;
        if (typeof shippingOptionId !== 'string' || !shippingOptionId) throw bad(`${String(product.name ?? 'An item')} needs shipping setup before checkout.`);
        return { item, product, variant, preorderEnabled, preorderExpectedShipAt, shippingOptionId, priceCents: Math.round((salePrice ?? price) * 100) };
      });

      const optionIds = [...new Set(pending.map((line) => String(line.shippingOptionId)))].sort();
      const { rows: optionRows } = await tx.query(`SELECT * FROM "ShippingOptions" WHERE "id" = ANY($1::text[]) ORDER BY "id" FOR UPDATE`, [optionIds]);
      const options = new Map(optionRows.map((row) => [String(row.id), row]));
      if (options.size !== optionIds.length) throw bad('A shipping option in your cart is no longer available.');

      const lines: LockedLine[] = pending.map(({ item, product, variant, preorderEnabled, preorderExpectedShipAt, shippingOptionId, priceCents }) => {
        const option = options.get(String(shippingOptionId))!;
        const productName = String(product.name ?? 'Product');
        const variantName = variant ? String(variant.name ?? '') : '';
        return {
          preorderEnabled, preorderExpectedShipAt,
          productId: item.productId, productName, variantId: item.variantId, variantName,
          name: variantName ? `${productName} (${variantName})` : `${productName}${product.size ? ` (${String(product.size)})` : ''}`,
          priceCents, quantity: item.quantity, shippingOptionId: String(option.id), shippingOptionName: String(option.name ?? ''),
          shippingOptionPriceCents: Math.round(Number(option.price ?? 0) * 100),
        };
      });
      const subtotalCents = lines.reduce((sum, line) => sum + line.priceCents * line.quantity, 0);

      let discountCents = 0;
      let discountCode = '';
      let discountCodeId: string | null = null;
      if (input.discountCode?.trim()) {
        const { rows } = await tx.query(
          `SELECT * FROM "DiscountCodes" WHERE upper("code") = upper($1) ORDER BY "createdAt" LIMIT 1 FOR UPDATE`,
          [input.discountCode.trim()],
        );
        const code = rows[0];
        if (!code || code.active !== true) throw bad('That code is not valid.');
        if (code.expiresAt && new Date(code.expiresAt).getTime() < Date.now()) throw bad('That code has expired.');
        if (code.usageLimit != null && Number(code.timesUsed ?? 0) >= Number(code.usageLimit)) throw bad('That code has been fully used.');
        if (code.minimumOrder != null && subtotalCents < Math.round(Number(code.minimumOrder) * 100)) throw bad(`Minimum order for this code is $${Number(code.minimumOrder).toFixed(2)}.`);
        const amount = Math.max(0, Number(code.amount ?? 0));
        discountCents = code.discountType === 'Fixed'
          ? Math.min(subtotalCents, Math.round(amount * 100))
          : Math.min(subtotalCents, Math.round(subtotalCents * Math.min(amount, 100) / 100));
        discountCode = String(code.code ?? '').toUpperCase();
        discountCodeId = String(code.id);
      }

      const shippingBreakdown = optionIds.map((id) => {
        const option = options.get(id)!;
        return { shippingOptionId: id, name: String(option.name ?? ''), price: Number(option.price ?? 0), priceCents: Math.round(Number(option.price ?? 0) * 100) };
      });
      const shippingCents = shippingBreakdown.reduce((sum, option) => sum + option.priceCents, 0);
      const totalCents = subtotalCents - discountCents + shippingCents;
      if (totalCents <= 0) throw bad('Order total must be greater than zero.');
      const total = totalCents / 100;
      const cryptoAmount = isTest ? total : uniqueCryptoAmount(total, usdPrice, input.payCurrency as (typeof CURRENCIES)[number]);

      for (const line of lines) {
        const target = line.variantId ? 'ProductVariants' : 'Products';
        const id = line.variantId ?? line.productId;
        const { rows } = await tx.query(
          `UPDATE "${target}" SET "stock" = CASE WHEN "stock" IS NULL THEN NULL ELSE "stock" - $2 END, "updatedAt" = now()
           WHERE "id" = $1 AND ("stock" IS NULL OR "stock" >= $2) RETURNING "id"`,
          [id, line.quantity],
        );
        if (!rows[0]) throw bad(`${line.name} is no longer available in that quantity.`);
      }
      if (discountCodeId) {
        await tx.query(`UPDATE "DiscountCodes" SET "timesUsed" = COALESCE("timesUsed", 0) + 1, "updatedAt" = now() WHERE "id" = $1`, [discountCodeId]);
      }

      const itemSnapshots = lines.map((line) => ({
        preorderEnabled: line.preorderEnabled, preorderExpectedShipAt: line.preorderExpectedShipAt,
        productId: line.productId, productName: line.productName, variantId: line.variantId, variantName: line.variantName,
        name: line.name, price: line.priceCents / 100, quantity: line.quantity,
        shippingOptionId: line.shippingOptionId, shippingOptionName: line.shippingOptionName,
        shippingOptionPrice: line.shippingOptionPriceCents / 100, shippingOptionPriceCents: line.shippingOptionPriceCents,
      }));
      await tx.query(
        `INSERT INTO "Orders" (
          "id","orderNumber","customer","customerEmail","customerName","shippingAddress","streetAddress","city","postalCode","country",
          "itemsJson","shippingBreakdownJson","subtotal","discount","shipping","total","currency","subtotalCents","discountCents","shippingCents","totalCents",
          "discountCode","discountCodeId","payCurrency","cryptoAmount","payAddress","paymentExpiresAt","status","migrationVersion"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,'USD',$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,'Awaiting Payment',2)`,
        [
          orderId, orderNumber, context.user.id, context.user.email, input.customerName, shippingAddress,
          address.street, address.city, address.postalCode, address.country, JSON.stringify(itemSnapshots), JSON.stringify(shippingBreakdown),
          subtotalCents / 100, discountCents / 100, shippingCents / 100, total, subtotalCents, discountCents, shippingCents, totalCents,
          discountCode, discountCodeId, input.payCurrency, cryptoAmount, payAddress, paymentExpiresAt,
        ],
      );

      await tx.query(`UPDATE "Orders" SET "researchAcceptedAt"=now(), "acceptedMinimumAge"=$2 WHERE "id"=$1`, [orderId, input.confirmedMinimumAge]);
      const chargedOptions = new Set<string>();
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const allocatedShipping = chargedOptions.has(line.shippingOptionId) ? 0 : line.shippingOptionPriceCents;
        chargedOptions.add(line.shippingOptionId);
        await tx.query(
          `INSERT INTO "OrderItems" (
            "id","orderId","lineNumber","productId","productName","productSize","variantId","variantName",
            "shippingOptionId","shippingOptionName","shippingOptionPriceCents","unitPriceCents","quantity","lineSubtotalCents","discountCents","shippingCents"
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,0,$15)`,
          [crypto.randomUUID(), orderId, index, line.productId, line.productName, line.variantName || null, line.variantId, line.variantName || null,
            line.shippingOptionId, line.shippingOptionName, line.shippingOptionPriceCents, line.priceCents, line.quantity,
            line.priceCents * line.quantity, allocatedShipping],
        );
        await tx.query(`UPDATE "OrderItems" SET "preorderEnabled"=$3, "preorderExpectedShipAt"=$4 WHERE "orderId"=$1 AND "lineNumber"=$2`, [orderId, index, line.preorderEnabled, line.preorderExpectedShipAt]);
      }
      await enqueueOrderPlacedEmails(tx, {
        id: orderId,
        orderNumber,
        customerEmail: context.user.email,
        customerName: input.customerName,
        total,
        cryptoAmount,
        payCurrency: input.payCurrency,
        paymentExpiresAt,
        status: 'Awaiting Payment',
      });
      return { cryptoAmount, total };
    });

    const order = await db.orders.findOne({ id: orderId });
    if (!order) throw new Error('Order creation failed');
    if (isTest) await markPaid(order.id, `TEST-${orderNumber}`);
    return { id: order.id };
  },
});
