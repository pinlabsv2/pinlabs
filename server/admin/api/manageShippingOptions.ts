import { z } from 'zod';
import { createEndpoint, AppError } from '../../core/endpoint.js';
import { db } from '../../core/db.js';

const optionSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  price: z.number().finite().min(0),
});
const bad = (message: string) => new AppError({ code: 'BAD_REQUEST', message, userFacingMessage: message });

async function listOptions() {
  const { rows } = await db.sql({
    query: `SELECT s.*,
      (SELECT count(*)::int FROM "Products" p WHERE p."shippingOptionId" = s."id") AS "productCount",
      (SELECT count(*)::int FROM "ProductVariants" v WHERE v."shippingOptionId" = s."id") AS "variantCount"
    FROM "ShippingOptions" s
    ORDER BY lower(s."name"), s."id"`,
  });
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    price: Number(row.price ?? 0),
    productCount: Number(row.productCount ?? 0),
    variantCount: Number(row.variantCount ?? 0),
    assignmentCount: Number(row.productCount ?? 0) + Number(row.variantCount ?? 0),
  }));
}

export default createEndpoint({
  description: 'Lists, saves or deletes reusable shipping options',
  inputSchema: z.object({
    action: z.enum(['list', 'save', 'delete']),
    option: optionSchema.optional(),
    id: z.string().optional(),
  }),
  outputSchema: z.object({
    options: z.array(optionSchema.extend({
      id: z.string(), productCount: z.number(), variantCount: z.number(), assignmentCount: z.number(),
    })),
  }),
  execute: async ({ input }) => {
    if (input.action === 'save') {
      if (!input.option) throw bad('Shipping option details are required.');
      const name = input.option.name.trim();
      const price = Math.round(input.option.price * 100) / 100;
      await db.transaction(async (tx) => {
        const duplicate = await tx.query(
          `SELECT "id" FROM "ShippingOptions" WHERE lower("name") = lower($1) AND ($2::text IS NULL OR "id" <> $2) LIMIT 1`,
          [name, input.option?.id ?? null],
        );
        if (duplicate.rows[0]) throw bad('A shipping option with that name already exists.');
        if (input.option?.id) {
          const updated = await tx.query(
            `UPDATE "ShippingOptions" SET "name" = $2, "price" = $3, "updatedAt" = now() WHERE "id" = $1 RETURNING "id"`,
            [input.option.id, name, price],
          );
          if (!updated.rows[0]) throw bad('Shipping option not found.');
        } else {
          await tx.query(
            `INSERT INTO "ShippingOptions" ("id", "name", "price") VALUES ($1, $2, $3)`,
            [crypto.randomUUID(), name, price],
          );
        }
      });
    }

    if (input.action === 'delete') {
      if (!input.id) throw bad('Shipping option ID is required.');
      await db.transaction(async (tx) => {
        const { rows } = await tx.query(
          `SELECT
            (SELECT count(*)::int FROM "Products" WHERE "shippingOptionId" = $1) AS "productCount",
            (SELECT count(*)::int FROM "ProductVariants" WHERE "shippingOptionId" = $1) AS "variantCount"`,
          [input.id],
        );
        const products = Number(rows[0]?.productCount ?? 0);
        const variants = Number(rows[0]?.variantCount ?? 0);
        if (products + variants > 0) {
          throw bad(`This shipping option is assigned to ${products} product${products === 1 ? '' : 's'} and ${variants} variant${variants === 1 ? '' : 's'}. Reassign them before deleting it.`);
        }
        const deleted = await tx.query(`DELETE FROM "ShippingOptions" WHERE "id" = $1 RETURNING "id"`, [input.id]);
        if (!deleted.rows[0]) throw bad('Shipping option not found.');
      });
    }

    return { options: await listOptions() };
  },
});
