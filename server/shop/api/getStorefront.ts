import { z } from 'zod';
import { createEndpoint } from '../../core/endpoint.js';
import { db } from '../../core/db.js';
import { getSettings } from '../lib/server/store.js';
import { CURRENCIES, META, walletFor } from '../lib/server/crypto.js';

export default createEndpoint({
  description: 'Loads the storefront: products, categories, promo banner, shipping rules, support contacts and policies',
  inputSchema: z.object({}),
  outputSchema: z.object({
    products: z.array(z.object({
      id: z.string(), name: z.string(), description: z.string(), price: z.number(), salePrice: z.number().nullable(), size: z.string(),
      purity: z.string(), category: z.string(), imageUrl: z.string(), stock: z.number().nullable(), featured: z.boolean(), paidUnits: z.number(), coaUrl: z.string(),
    })),
    categories: z.array(z.string()),
    promo: z.object({ active: z.boolean(), title: z.string(), subtitle: z.string(), code: z.string() }),
    shippingFee: z.number(),
    freeShippingOver: z.number().nullable(),
    storeName: z.string(),
    paymentMethods: z.array(z.object({ code: z.string(), network: z.string() })),
    testMode: z.boolean(),
    support: z.array(z.object({ label: z.string(), channel: z.string(), handle: z.string() })),
    theme: z.object({ primary: z.string(), accent: z.string() }),
    policies: z.object({ terms: z.string(), privacy: z.string(), shipping: z.string(), refund: z.string() }),
  }),
  execute: async () => {
    const [productResult, settings, cats, support] = await Promise.all([
      db.sql({
        query: `
          SELECT p.*, COALESCE(s."paidUnits", 0)::float8 AS "paidUnits"
          FROM "Products" p
          LEFT JOIN (
            SELECT item->>'productId' AS "productId",
              SUM(COALESCE((item->>'quantity')::numeric, 0)) AS "paidUnits"
            FROM "Orders" o
            CROSS JOIN LATERAL jsonb_array_elements(o."itemsJson"::jsonb) item
            WHERE o."paidAt" IS NOT NULL
              OR o."status" IN ('Paid', 'Processing', 'Shipped', 'In Transit', 'Out for Delivery', 'Delivered', 'Exception', 'Refunded')
            GROUP BY item->>'productId'
          ) s ON s."productId" = p."id"
          WHERE p."active" IS TRUE
          ORDER BY p."featured" DESC NULLS LAST, COALESCE(s."paidUnits", 0) DESC,
            lower(p."name") ASC, p."id" ASC
          LIMIT 500
        `,
      }),
      getSettings(),
      db.categories.findAll({ sort: [{ field: 'sortOrder', direction: 'asc' }], limit: 200 }),
      db.supportContacts.findAll({ sort: [{ field: 'sortOrder', direction: 'asc' }], limit: 100 }),
    ]);
    return {
      products: productResult.rows.map((row) => {
        const price = typeof row.price === 'number' ? row.price : 0;
        const sale = typeof row.salePrice === 'number' && row.salePrice > 0 && row.salePrice < price ? row.salePrice : null;
        return {
          id: String(row.id), name: typeof row.name === 'string' ? row.name : '',
          description: typeof row.description === 'string' ? row.description : '', price, salePrice: sale,
          size: typeof row.size === 'string' ? row.size : '', purity: typeof row.purity === 'string' ? row.purity : '',
          category: typeof row.category === 'string' ? row.category : '', imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl : '',
          stock: typeof row.stock === 'number' ? row.stock : null, featured: row.featured === true,
          paidUnits: typeof row.paidUnits === 'number' ? row.paidUnits : Number(row.paidUnits ?? 0),
          coaUrl: row.showCoa === true && typeof row.coaUrl === 'string' ? row.coaUrl : '',
        };
      }),
      categories: cats.records.map((c) => c.name ?? '').filter(Boolean),
      promo: {
        active: !!settings?.promoActive, title: settings?.promoTitle ?? '',
        subtitle: settings?.promoSubtitle ?? '', code: settings?.promoCode ?? '',
      },
      shippingFee: settings?.shippingFee ?? 0,
      freeShippingOver: settings?.freeShippingOver ?? null,
      storeName: settings?.storeName ?? 'PinLabs',
      paymentMethods: CURRENCIES.filter((c) => walletFor(settings, c)).map((c) => ({ code: c, network: META[c].network })),
      testMode: !!settings?.testMode,
      support: support.records.map((c) => ({ label: c.label ?? '', channel: c.channel ?? 'Email', handle: c.handle ?? '' })),
      theme: { primary: settings?.primaryColor ?? '', accent: settings?.accentColor ?? '' },
      policies: {
        terms: settings?.termsOfService ?? '', privacy: settings?.privacyPolicy ?? '',
        shipping: settings?.shippingPolicy ?? '', refund: settings?.refundPolicy ?? '',
      },
    };
  },
});
