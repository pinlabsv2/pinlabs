import { z } from 'zod';
import { createEndpoint, AppError } from '../../core/endpoint.js';
import { db } from '../../core/db.js';

const variantBaseSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(160),
  price: z.number().finite().min(0),
  salePrice: z.number().finite().min(0).nullable(),
  stock: z.number().int().min(0).nullable(),
  shippingOptionId: z.string().nullable(),
  active: z.boolean(),
  sortOrder: z.number().int().min(0),
});
const variantSchema = variantBaseSchema.superRefine((variant, context) => {
  if (variant.salePrice != null && variant.salePrice >= variant.price) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['salePrice'], message: 'Sale price must be lower than regular price' });
  }
});

const productBaseSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(20_000),
  price: z.number().finite().min(0),
  salePrice: z.number().finite().min(0).nullable(),
  size: z.string().max(200),
  purity: z.string().max(200),
  category: z.string().trim().max(200),
  imageUrl: z.string().max(4000),
  stock: z.number().int().min(0).nullable(),
  active: z.boolean(),
  featured: z.boolean(),
  coaUrl: z.string().max(4000),
  showCoa: z.boolean(),
  hasVariants: z.boolean(),
  shippingScope: z.enum(['product', 'variant']),
  shippingOptionId: z.string().nullable(),
  subcategoryDividerId: z.string().nullable(),
  variants: z.array(variantSchema).max(200),
});
const productSchema = productBaseSchema.superRefine((product, context) => {
  if (product.salePrice != null && product.salePrice >= product.price) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['salePrice'], message: 'Sale price must be lower than regular price' });
  }
});

const savedVariantSchema = variantBaseSchema.extend({ id: z.string() });
const savedProductSchema = productBaseSchema.extend({
  id: z.string(),
  variants: z.array(savedVariantSchema),
  setupRequired: z.boolean(),
  variantCount: z.number(),
  minPrice: z.number(),
  maxPrice: z.number(),
  stockSummary: z.number().nullable(),
});
const bad = (message: string) => new AppError({ code: 'BAD_REQUEST', message, userFacingMessage: message });
const effectivePrice = (price: number, salePrice: number | null) => salePrice != null && salePrice > 0 && salePrice < price ? salePrice : price;

async function listProducts() {
  const [{ rows: productRows }, { rows: variantRows }] = await Promise.all([
    db.sql({ query: `SELECT * FROM "Products" ORDER BY lower(COALESCE("name", '')), "id" LIMIT 2000` }),
    db.sql({ query: `SELECT * FROM "ProductVariants" ORDER BY "productId", COALESCE("sortOrder", 0), "createdAt", "id" LIMIT 5000` }),
  ]);
  const variantsByProduct = new Map<string, Array<z.infer<typeof savedVariantSchema>>>();
  for (const row of variantRows) {
    const variant = {
      id: String(row.id), name: String(row.name ?? ''), price: Number(row.price ?? 0),
      salePrice: typeof row.salePrice === 'number' ? row.salePrice : null,
      stock: typeof row.stock === 'number' ? row.stock : null,
      shippingOptionId: typeof row.shippingOptionId === 'string' ? row.shippingOptionId : null,
      active: row.active !== false, sortOrder: Number(row.sortOrder ?? 0),
    };
    const productId = String(row.productId ?? '');
    variantsByProduct.set(productId, [...(variantsByProduct.get(productId) ?? []), variant]);
  }

  const products = productRows.map((row) => {
    const variants = variantsByProduct.get(String(row.id)) ?? [];
    const hasVariants = row.hasVariants === true;
    const shippingScope = row.shippingScope === 'variant' ? 'variant' as const : 'product' as const;
    const activeVariants = variants.filter((variant) => variant.active);
    const setupRequired = hasVariants
      ? activeVariants.length === 0 || (shippingScope === 'product'
        ? typeof row.shippingOptionId !== 'string'
        : activeVariants.some((variant) => !variant.shippingOptionId))
      : typeof row.shippingOptionId !== 'string';
    const prices = hasVariants && activeVariants.length
      ? activeVariants.map((variant) => effectivePrice(variant.price, variant.salePrice))
      : [effectivePrice(Number(row.price ?? 0), typeof row.salePrice === 'number' ? row.salePrice : null)];
    const stocks = hasVariants ? activeVariants.map((variant) => variant.stock) : [typeof row.stock === 'number' ? row.stock : null];
    return {
      id: String(row.id), name: String(row.name ?? ''), description: String(row.description ?? ''), price: Number(row.price ?? 0),
      salePrice: typeof row.salePrice === 'number' ? row.salePrice : null, size: String(row.size ?? ''), purity: String(row.purity ?? ''),
      category: String(row.category ?? ''), imageUrl: String(row.imageUrl ?? ''), stock: typeof row.stock === 'number' ? row.stock : null,
      active: row.active === true, featured: row.featured === true, coaUrl: String(row.coaUrl ?? ''), showCoa: row.showCoa === true,
      hasVariants, shippingScope, shippingOptionId: typeof row.shippingOptionId === 'string' ? row.shippingOptionId : null,
      subcategoryDividerId: typeof row.subcategoryDividerId === 'string' ? row.subcategoryDividerId : null,
      variants, setupRequired, variantCount: variants.length, minPrice: Math.min(...prices), maxPrice: Math.max(...prices),
      stockSummary: stocks.some((stock) => stock == null) ? null : stocks.reduce<number>((sum, stock) => sum + Number(stock), 0),
    };
  });
  return {
    products,
    images: [...new Set(products.map((product) => product.imageUrl).filter(Boolean))],
  };
}

async function validateReferences(tx: { query: (query: string, params?: unknown[]) => Promise<{ rows: any[] }> }, product: z.infer<typeof productSchema>) {
  const optionIds = new Set<string>();
  if (product.shippingOptionId) optionIds.add(product.shippingOptionId);
  for (const variant of product.variants) if (variant.shippingOptionId) optionIds.add(variant.shippingOptionId);
  if (optionIds.size) {
    const { rows } = await tx.query(`SELECT "id" FROM "ShippingOptions" WHERE "id" = ANY($1::text[])`, [[...optionIds]]);
    if (rows.length !== optionIds.size) throw bad('One of the selected shipping options no longer exists.');
  }
  if (product.subcategoryDividerId) {
    const { rows } = await tx.query(
      `SELECT d."id" FROM "SubcategoryDividers" d JOIN "Categories" c ON c."id" = d."categoryId"
       WHERE d."id" = $1 AND c."name" = $2 LIMIT 1`,
      [product.subcategoryDividerId, product.category],
    );
    if (!rows[0]) throw bad('The selected divider does not belong to this product category.');
  }
}

function validateConfiguration(product: z.infer<typeof productSchema>) {
  const ids = product.variants.flatMap((variant) => variant.id ? [variant.id] : []);
  if (new Set(ids).size !== ids.length) throw bad('A variant was submitted more than once.');
  if (!product.hasVariants) {
    if (product.shippingScope !== 'product') throw bad('Products without variants must use product-level shipping.');
    if (product.variants.length) throw bad('Remove variants or enable variants for this product.');
    if (product.active && !product.shippingOptionId) throw bad('Choose a shipping option before making this product visible.');
    return;
  }
  const activeVariants = product.variants.filter((variant) => variant.active);
  if (product.active && !activeVariants.length) throw bad('Add at least one active variant before making this product visible.');
  if (product.shippingScope === 'product') {
    if (product.active && !product.shippingOptionId) throw bad('Choose a product shipping option before making this product visible.');
  } else if (product.active && activeVariants.some((variant) => !variant.shippingOptionId)) {
    throw bad('Every active variant needs a shipping option before this product can be visible.');
  }
}

export default createEndpoint({
  description: 'Lists, creates, updates or deletes parent products and their variants',
  inputSchema: z.object({ action: z.enum(['list', 'save', 'delete']), product: productSchema.optional(), id: z.string().optional() }),
  outputSchema: z.object({ products: z.array(savedProductSchema), images: z.array(z.string()) }),
  execute: async ({ input }) => {
    if (input.action === 'save') {
      if (!input.product) throw bad('Product details are required.');
      const product = input.product;
      validateConfiguration(product);
      await db.transaction(async (tx) => {
        await validateReferences(tx, product);
        const productId = product.id ?? crypto.randomUUID();
        if (product.id) {
          const current = await tx.query(`SELECT "id" FROM "Products" WHERE "id" = $1 FOR UPDATE`, [product.id]);
          if (!current.rows[0]) throw bad('Product not found.');
        }
        const parentShipping = product.shippingScope === 'product' ? product.shippingOptionId : null;
        const parentRecord = [
          product.name, product.description, product.price, product.salePrice, product.size, product.purity, product.category,
          product.imageUrl || null, product.stock, product.active, product.featured, product.coaUrl || null, product.showCoa,
          product.hasVariants, product.hasVariants ? product.shippingScope : 'product', parentShipping, product.subcategoryDividerId,
        ];
        if (product.id) {
          await tx.query(
            `UPDATE "Products" SET "name"=$2,"description"=$3,"price"=$4,"salePrice"=$5,"size"=$6,"purity"=$7,
              "category"=$8,"imageUrl"=$9,"stock"=$10,"active"=$11,"featured"=$12,"coaUrl"=$13,"showCoa"=$14,
              "hasVariants"=$15,"shippingScope"=$16,"shippingOptionId"=$17,"subcategoryDividerId"=$18,"updatedAt"=now()
             WHERE "id"=$1`,
            [productId, ...parentRecord],
          );
        } else {
          await tx.query(
            `INSERT INTO "Products" ("id","name","description","price","salePrice","size","purity","category","imageUrl","stock",
              "active","featured","coaUrl","showCoa","hasVariants","shippingScope","shippingOptionId","subcategoryDividerId")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
            [productId, ...parentRecord],
          );
        }

        const existing = await tx.query(`SELECT "id" FROM "ProductVariants" WHERE "productId" = $1 FOR UPDATE`, [productId]);
        const existingIds = new Set(existing.rows.map((row) => String(row.id)));
        const keptIds = new Set<string>();
        for (const variant of product.hasVariants ? product.variants : []) {
          const variantId = variant.id ?? crypto.randomUUID();
          if (variant.id && !existingIds.has(variant.id)) throw bad('A variant does not belong to this product.');
          keptIds.add(variantId);
          const shippingOptionId = product.shippingScope === 'variant' ? variant.shippingOptionId : null;
          if (variant.id) {
            await tx.query(
              `UPDATE "ProductVariants" SET "name"=$3,"price"=$4,"salePrice"=$5,"stock"=$6,"shippingOptionId"=$7,
                "active"=$8,"sortOrder"=$9,"updatedAt"=now() WHERE "id"=$1 AND "productId"=$2`,
              [variantId, productId, variant.name, variant.price, variant.salePrice, variant.stock, shippingOptionId, variant.active, variant.sortOrder],
            );
          } else {
            await tx.query(
              `INSERT INTO "ProductVariants" ("id","productId","name","price","salePrice","stock","shippingOptionId","active","sortOrder")
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
              [variantId, productId, variant.name, variant.price, variant.salePrice, variant.stock, shippingOptionId, variant.active, variant.sortOrder],
            );
          }
        }
        for (const existingId of existingIds) {
          if (!keptIds.has(existingId)) await tx.query(`DELETE FROM "ProductVariants" WHERE "id" = $1 AND "productId" = $2`, [existingId, productId]);
        }
      });
    }
    if (input.action === 'delete') {
      if (!input.id) throw bad('Product ID is required.');
      const deleted = await db.sql({ query: `DELETE FROM "Products" WHERE "id" = $1 RETURNING "id"`, params: [input.id] });
      if (!deleted.rows[0]) throw bad('Product not found.');
    }
    return listProducts();
  },
});
