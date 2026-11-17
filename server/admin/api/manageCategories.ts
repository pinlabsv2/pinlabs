import { z } from 'zod';
import { createEndpoint, AppError } from '../../core/endpoint.js';
import { categoryColor } from '../../../shared/categoryColors.js';
import { db } from '../../core/db.js';

const bad = (message: string) => new AppError({ code: 'BAD_REQUEST', message, userFacingMessage: message });
const dividerSchema = z.object({ id: z.string(), categoryId: z.string(), name: z.string(), sortOrder: z.number(), productCount: z.number() });

async function listCategories() {
  const [{ rows: categories }, { rows: dividers }] = await Promise.all([
    db.sql({
      query: `SELECT c.*,
        (SELECT count(*)::int FROM "Products" p WHERE p."category" = c."name") AS "productCount"
      FROM "Categories" c ORDER BY COALESCE(c."sortOrder", 0), lower(COALESCE(c."name", '')), c."id"`,
    }),
    db.sql({
      query: `SELECT d.*,
        (SELECT count(*)::int FROM "Products" p WHERE p."subcategoryDividerId" = d."id") AS "productCount"
      FROM "SubcategoryDividers" d ORDER BY d."categoryId", COALESCE(d."sortOrder", 0), lower(COALESCE(d."name", '')), d."id"`,
    }),
  ]);
  const byCategory = new Map<string, z.infer<typeof dividerSchema>[]>();
  for (const row of dividers) {
    const divider = {
      id: String(row.id), categoryId: String(row.categoryId), name: String(row.name ?? ''),
      sortOrder: Number(row.sortOrder ?? 0), productCount: Number(row.productCount ?? 0),
    };
    byCategory.set(divider.categoryId, [...(byCategory.get(divider.categoryId) ?? []), divider]);
  }
  return categories.map((category,index) => ({
    color: categoryColor(category.color,index),
    id: String(category.id), name: String(category.name ?? ''), sortOrder: Number(category.sortOrder ?? 0),
    productCount: Number(category.productCount ?? 0), dividers: byCategory.get(String(category.id)) ?? [],
  }));
}

export default createEndpoint({
  description: 'Lists and manages product categories and their visual dividers',
  inputSchema: z.object({
    action: z.enum(['list', 'save', 'delete', 'dividerSave', 'dividerDelete', 'colorSave']),
    id: z.string().optional(),
    categoryId: z.string().optional(),
    color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex color').optional(),
    name: z.string().trim().max(160).optional(),
    sortOrder: z.number().int().min(0).optional(),
  }),
  outputSchema: z.object({
    categories: z.array(z.object({
      id: z.string(), name: z.string(), color: z.string(), sortOrder: z.number(), productCount: z.number(), dividers: z.array(dividerSchema),
    })),
  }),
  execute: async ({ input }) => {
    if (input.action === 'save') {
      const name = input.name?.trim();
      if (!name) throw bad('Enter a category name.');
      const savedId = input.id ?? crypto.randomUUID();
      await db.transaction(async (tx) => {
        const duplicate = await tx.query(
          `SELECT "id" FROM "Categories" WHERE lower("name") = lower($1) AND ($2::text IS NULL OR "id" <> $2) LIMIT 1`,
          [name, input.id ?? null],
        );
        if (duplicate.rows[0]) throw bad('A category with that name already exists.');
        if (input.id) {
          const current = await tx.query(`SELECT * FROM "Categories" WHERE "id" = $1 FOR UPDATE`, [input.id]);
          if (!current.rows[0]) throw bad('Category not found.');
          await tx.query(
            `UPDATE "Categories" SET "name" = $2, "sortOrder" = $3, "updatedAt" = now() WHERE "id" = $1`,
            [input.id, name, input.sortOrder ?? Number(current.rows[0].sortOrder ?? 0)],
          );
          if (current.rows[0].name !== name) {
            await tx.query(`UPDATE "Products" SET "category" = $2, "updatedAt" = now() WHERE "category" = $1`, [current.rows[0].name, name]);
          }
        } else {
          await tx.query(
            `INSERT INTO "Categories" ("id", "name", "sortOrder", "color") VALUES ($1, $2, $3, $4)`,
            [savedId, name, input.sortOrder ?? 99, categoryColor(input.color, Number((await tx.query(`SELECT count(*)::int AS "count" FROM "Categories"`)).rows[0].count))],
          );
        }
        if (input.color !== undefined) await tx.query(`UPDATE "Categories" SET "color"=$2, "updatedAt"=now() WHERE "id"=$1`, [input.id ?? savedId,input.color.toUpperCase()]);
      });
    }

    if (input.action === 'colorSave') {
      if (!input.id || !input.color) throw bad('Choose a category and a six-digit hex color.');
      const result = await db.sql({query:`UPDATE "Categories" SET "color"=$2, "updatedAt"=now() WHERE "id"=$1 RETURNING "id"`,params:[input.id,input.color.toUpperCase()]});
      if (!result.rows[0]) throw bad('Category not found.');
    }

    if (input.action === 'delete') {
      if (!input.id) throw bad('Category ID is required.');
      await db.transaction(async (tx) => {
        const { rows } = await tx.query(
          `SELECT c."id", c."name",
            (SELECT count(*)::int FROM "Products" p WHERE p."category" = c."name") AS "productCount",
            (SELECT count(*)::int FROM "SubcategoryDividers" d WHERE d."categoryId" = c."id") AS "dividerCount"
           FROM "Categories" c WHERE c."id" = $1 FOR UPDATE`,
          [input.id],
        );
        if (!rows[0]) throw bad('Category not found.');
        const products = Number(rows[0].productCount ?? 0);
        const dividers = Number(rows[0].dividerCount ?? 0);
        if (products || dividers) throw bad(`Move or delete the category's ${products} product${products === 1 ? '' : 's'} and ${dividers} divider${dividers === 1 ? '' : 's'} first.`);
        await tx.query(`DELETE FROM "Categories" WHERE "id" = $1`, [input.id]);
      });
    }

    if (input.action === 'dividerSave') {
      const name = input.name?.trim();
      if (!input.categoryId) throw bad('Choose a category for this divider.');
      if (!name) throw bad('Enter a divider name.');
      await db.transaction(async (tx) => {
        const category = await tx.query(`SELECT "id" FROM "Categories" WHERE "id" = $1 FOR UPDATE`, [input.categoryId]);
        if (!category.rows[0]) throw bad('Category not found.');
        const duplicate = await tx.query(
          `SELECT "id" FROM "SubcategoryDividers" WHERE "categoryId" = $1 AND lower("name") = lower($2)
           AND ($3::text IS NULL OR "id" <> $3) LIMIT 1`,
          [input.categoryId, name, input.id ?? null],
        );
        if (duplicate.rows[0]) throw bad('That category already has a divider with this name.');
        if (input.id) {
          const updated = await tx.query(
            `UPDATE "SubcategoryDividers" SET "name" = $3, "sortOrder" = $4, "updatedAt" = now()
             WHERE "id" = $1 AND "categoryId" = $2 RETURNING "id"`,
            [input.id, input.categoryId, name, input.sortOrder ?? 0],
          );
          if (!updated.rows[0]) throw bad('Divider not found in this category.');
        } else {
          await tx.query(
            `INSERT INTO "SubcategoryDividers" ("id", "categoryId", "name", "sortOrder") VALUES ($1, $2, $3, $4)`,
            [crypto.randomUUID(), input.categoryId, name, input.sortOrder ?? 0],
          );
        }
      });
    }

    if (input.action === 'dividerDelete') {
      if (!input.id) throw bad('Divider ID is required.');
      await db.transaction(async (tx) => {
        const divider = await tx.query(`SELECT "id" FROM "SubcategoryDividers" WHERE "id" = $1 FOR UPDATE`, [input.id]);
        if (!divider.rows[0]) throw bad('Divider not found.');
        await tx.query(`UPDATE "Products" SET "subcategoryDividerId" = NULL, "updatedAt" = now() WHERE "subcategoryDividerId" = $1`, [input.id]);
        await tx.query(`DELETE FROM "SubcategoryDividers" WHERE "id" = $1`, [input.id]);
      });
    }

    return { categories: await listCategories() };
  },
});
