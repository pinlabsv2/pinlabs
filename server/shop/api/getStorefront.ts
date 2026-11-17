import { z } from 'zod';
import { createEndpoint } from '../../core/endpoint.js';
import { db } from '../../core/db.js';
import { activeSeason, seasons, seasonalDefaults, type Season } from '../../../shared/seasonal.js';
import { getSettings } from '../lib/server/store.js';
import { CURRENCIES, META, walletFor } from '../lib/server/crypto.js';

const shippingOptionSchema = z.object({ id: z.string(), name: z.string(), price: z.number() });
const preorderFields = { preorderEnabled: z.boolean(), preorderExpectedShipAt: z.string().nullable() };
const variantSchema = z.object({
  ...preorderFields,
  id: z.string(), name: z.string(), price: z.number(), salePrice: z.number().nullable(), stock: z.number().nullable(),
  shippingOption: shippingOptionSchema.nullable(), purchasable: z.boolean(), unavailableReason: z.string(),
});

export default createEndpoint({
  description: 'Loads the structured storefront catalog, branding, payment methods, support and policies',
  inputSchema: z.object({}),
  outputSchema: z.object({
    products: z.array(z.object({
      ...preorderFields,
      id: z.string(), name: z.string(), description: z.string(), price: z.number(), salePrice: z.number().nullable(), size: z.string(),
      purity: z.string(), category: z.string(), imageUrl: z.string(), stock: z.number().nullable(), featured: z.boolean(), paidUnits: z.number(), coaUrl: z.string(),
      hasVariants: z.boolean(), shippingScope: z.enum(['product', 'variant']), subcategoryDividerId: z.string().nullable(),
      shippingOption: shippingOptionSchema.nullable(), variants: z.array(variantSchema), minPrice: z.number(), maxPrice: z.number(),
      purchasable: z.boolean(), unavailableReason: z.string(),
    })),
    categories: z.array(z.object({
      id: z.string(), name: z.string(), sortOrder: z.number(),
      dividers: z.array(z.object({ id: z.string(), name: z.string(), sortOrder: z.number() })),
    })),
    promo: z.object({ active: z.boolean(), title: z.string(), subtitle: z.string(), code: z.string() }),
    storeName: z.string(), paymentMethods: z.array(z.object({ code: z.string(), network: z.string() })), testMode: z.boolean(),
    support: z.array(z.object({ label: z.string(), channel: z.string(), handle: z.string() })),
    minimumAge: z.number(),
    theme: z.object({ primary: z.string(), accent: z.string(), seasonal: z.string(), configuredSeasonal: z.string(), intensity: z.string(), motion: z.boolean(), headline: z.string(), subtitle: z.string(), announcement: z.string(), startsAt: z.string(), endsAt: z.string(), countdownAt: z.string(), serverTime: z.string() }),
    policies: z.object({ terms: z.string(), privacy: z.string(), shipping: z.string(), refund: z.string() }),
  }),
  execute: async () => {
    const [productResult, variantResult, settings, cats, dividerResult, support] = await Promise.all([
      db.sql({ query: `
        SELECT p.*, COALESCE(s."paidUnits", 0)::float8 AS "paidUnits",
          so."id" AS "shippingOptionResolvedId", so."name" AS "shippingOptionResolvedName", so."price" AS "shippingOptionResolvedPrice"
        FROM "Products" p
        LEFT JOIN "ShippingOptions" so ON so."id" = p."shippingOptionId"
        LEFT JOIN (
          SELECT item->>'productId' AS "productId", SUM(COALESCE((item->>'quantity')::numeric, 0)) AS "paidUnits"
          FROM "Orders" o CROSS JOIN LATERAL jsonb_array_elements(o."itemsJson"::jsonb) item
          WHERE o."paidAt" IS NOT NULL OR o."status" IN ('Paid','Processing','Shipped','In Transit','Out for Delivery','Delivered','Exception','Refunded')
          GROUP BY item->>'productId'
        ) s ON s."productId" = p."id"
        WHERE p."active" IS TRUE
        ORDER BY p."featured" DESC NULLS LAST, COALESCE(s."paidUnits", 0) DESC, lower(p."name") ASC, p."id" ASC
        LIMIT 500
      ` }),
      db.sql({ query: `
        SELECT v.*, so."id" AS "shippingOptionResolvedId", so."name" AS "shippingOptionResolvedName", so."price" AS "shippingOptionResolvedPrice"
        FROM "ProductVariants" v LEFT JOIN "ShippingOptions" so ON so."id" = v."shippingOptionId"
        WHERE v."active" IS TRUE ORDER BY v."productId", COALESCE(v."sortOrder", 0), v."createdAt", v."id" LIMIT 5000
      ` }),
      getSettings(),
      db.categories.findAll({ sort: [{ field: 'sortOrder', direction: 'asc' }], limit: 200 }),
      db.subcategoryDividers.findAll({ sort: [{ field: 'categoryId' }, { field: 'sortOrder' }], limit: 1000 }),
      db.supportContacts.findAll({ sort: [{ field: 'sortOrder', direction: 'asc' }], limit: 100 }),
    ]);

    const optionFrom = (row: Record<string, unknown>) => typeof row.shippingOptionResolvedId === 'string' ? {
      id: row.shippingOptionResolvedId,
      name: typeof row.shippingOptionResolvedName === 'string' ? row.shippingOptionResolvedName : '',
      price: Number(row.shippingOptionResolvedPrice ?? 0),
    } : null;
    const variantsByProduct = new Map<string, Array<z.infer<typeof variantSchema>>>();
    for (const row of variantResult.rows) {
      const stock = typeof row.stock === 'number' ? row.stock : null;
      const option = optionFrom(row);
      const purchasable = !!option && (stock == null || stock > 0);
      const variant = {
        preorderEnabled: row.preorderEnabled === true, preorderExpectedShipAt: row.preorderExpectedShipAt ? new Date(row.preorderExpectedShipAt as string).toISOString() : null,
        id: String(row.id), name: String(row.name ?? ''), price: Number(row.price ?? 0),
        salePrice: typeof row.salePrice === 'number' && row.salePrice > 0 && row.salePrice < Number(row.price ?? 0) ? row.salePrice : null,
        stock, shippingOption: option, purchasable,
        unavailableReason: !option ? 'Shipping setup required' : stock === 0 ? 'Sold out' : '',
      };
      const productId = String(row.productId ?? '');
      variantsByProduct.set(productId, [...(variantsByProduct.get(productId) ?? []), variant]);
    }

    const products = productResult.rows.map((row) => {
      const price = Number(row.price ?? 0);
      const salePrice = typeof row.salePrice === 'number' && row.salePrice > 0 && row.salePrice < price ? row.salePrice : null;
      const stock = typeof row.stock === 'number' ? row.stock : null;
      const hasVariants = row.hasVariants === true;
      const shippingScope = row.shippingScope === 'variant' ? 'variant' as const : 'product' as const;
      const parentOption = optionFrom(row);
      const rawVariants = variantsByProduct.get(String(row.id)) ?? [];
      const variants = rawVariants.map((variant) => {
        const option = shippingScope === 'product' ? parentOption : variant.shippingOption;
        const preorderEnabled = row.preorderEnabled === true || variant.preorderEnabled;
        const preorderExpectedShipAt = row.preorderEnabled === true ? (row.preorderExpectedShipAt ? new Date(row.preorderExpectedShipAt as string).toISOString() : null) : variant.preorderExpectedShipAt;
        const ready = !preorderEnabled || !!preorderExpectedShipAt && Date.parse(preorderExpectedShipAt) > Date.now() && variant.stock !== null;
        const purchasable = ready && !!option && (variant.stock == null || variant.stock > 0);
        return { ...variant, preorderEnabled, preorderExpectedShipAt, shippingOption: option, purchasable, unavailableReason: !ready ? 'Preorder date needs updating' : !option ? 'Shipping setup required' : variant.stock === 0 ? 'Sold out' : '' };
      });
      const missingVariantShipping = hasVariants && (shippingScope === 'product' ? !parentOption : variants.some((variant) => !variant.shippingOption));
      const anyVariantInStock = variants.some((variant) => variant.purchasable);
      const preorderEnabled = row.preorderEnabled === true;
      const preorderExpectedShipAt = row.preorderExpectedShipAt ? new Date(row.preorderExpectedShipAt as string).toISOString() : null;
      const ready = !preorderEnabled || !!preorderExpectedShipAt && Date.parse(preorderExpectedShipAt) > Date.now() && stock !== null;
      const purchasable = hasVariants
        ? variants.length > 0 && !missingVariantShipping && anyVariantInStock
        : ready && !!parentOption && (stock == null || stock > 0);
      const unavailableReason = purchasable ? ''
        : !hasVariants && !ready ? 'Preorder date needs updating'
        : hasVariants && variants.length === 0 ? 'No variants available'
        : missingVariantShipping || !hasVariants && !parentOption ? 'Shipping setup required'
        : 'Sold out';
      const effectivePrices = hasVariants && variants.length
        ? variants.map((variant) => variant.salePrice ?? variant.price)
        : [salePrice ?? price];
      return {
        preorderEnabled, preorderExpectedShipAt,
        id: String(row.id), name: String(row.name ?? ''), description: String(row.description ?? ''), price, salePrice,
        size: String(row.size ?? ''), purity: String(row.purity ?? ''), category: String(row.category ?? ''), imageUrl: String(row.imageUrl ?? ''),
        stock, featured: row.featured === true, paidUnits: Number(row.paidUnits ?? 0),
        coaUrl: row.showCoa === true && typeof row.coaUrl === 'string' ? row.coaUrl : '',
        hasVariants, shippingScope, subcategoryDividerId: typeof row.subcategoryDividerId === 'string' ? row.subcategoryDividerId : null,
        shippingOption: shippingScope === 'product' ? parentOption : null, variants,
        minPrice: Math.min(...effectivePrices), maxPrice: Math.max(...effectivePrices), purchasable, unavailableReason,
      };
    });

    const dividersByCategory = new Map<string, Array<{ id: string; name: string; sortOrder: number }>>();
    for (const divider of dividerResult.records) {
      const categoryId = divider.categoryId ?? '';
      const categoryDividers = dividersByCategory.get(categoryId) ?? [];
      categoryDividers.push({ id: divider.id, name: divider.name ?? '', sortOrder: divider.sortOrder ?? 0 });
      dividersByCategory.set(categoryId, categoryDividers);
    }
    const themeConfig = { ...seasonalDefaults, seasonalTheme: seasons.includes(settings?.seasonalTheme as Season) ? settings!.seasonalTheme as Season : 'default' as const, themeStartsAt: settings?.themeStartsAt ?? '', themeEndsAt: settings?.themeEndsAt ?? '' };
    return {
      products,
      categories: cats.records.map((category) => ({
        id: category.id, name: category.name ?? '', sortOrder: category.sortOrder ?? 0,
        dividers: dividersByCategory.get(category.id) ?? [],
      })),
      promo: { active: !!settings?.promoActive, title: settings?.promoTitle ?? '', subtitle: settings?.promoSubtitle ?? '', code: settings?.promoCode ?? '' },
      storeName: settings?.storeName ?? 'PinLabs',
      paymentMethods: CURRENCIES.filter((currency) => walletFor(settings, currency)).map((currency) => ({ code: currency, network: META[currency].network })),
      testMode: !!settings?.testMode,
      support: support.records.map((contact) => ({ label: contact.label ?? '', channel: contact.channel ?? 'Email', handle: contact.handle ?? '' })),
      minimumAge: settings?.minimumAge === 21 ? 21 : 18,
      theme: { primary: settings?.primaryColor ?? '', accent: settings?.accentColor ?? '', seasonal: activeSeason(themeConfig, Date.now()), configuredSeasonal: themeConfig.seasonalTheme, intensity: settings?.themeIntensity ?? 'balanced', motion: settings?.themeMotion !== false, headline: settings?.themeHeadline ?? '', subtitle: settings?.themeSubtitle ?? '', announcement: settings?.themeAnnouncement ?? '', startsAt: themeConfig.themeStartsAt, endsAt: themeConfig.themeEndsAt, countdownAt: settings?.themeCountdownAt ?? '', serverTime: new Date().toISOString() },
      policies: { terms: settings?.termsOfService ?? '', privacy: settings?.privacyPolicy ?? '', shipping: settings?.shippingPolicy ?? '', refund: settings?.refundPolicy ?? '' },
    };
  },
});
