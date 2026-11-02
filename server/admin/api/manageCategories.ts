import { z } from 'zod';
import { createEndpoint, AppError } from '../../core/endpoint.js';
import { db } from '../../core/db.js';

export default createEndpoint({
  description: 'Lists, adds, renames, reorders or removes product categories',
  inputSchema: z.object({
    action: z.enum(['list', 'save', 'delete']),
    id: z.string().optional(),
    name: z.string().optional(),
    sortOrder: z.number().optional(),
  }),
  outputSchema: z.object({ categories: z.array(z.object({ id: z.string(), name: z.string(), sortOrder: z.number(), productCount: z.number() })) }),
  execute: async ({ input }) => {
    if (input.action === 'save') {
      const name = input.name?.trim();
      if (!name) throw new AppError({ code: 'BAD_REQUEST', message: 'Name required', userFacingMessage: 'Enter a category name' });
      if (input.id) {
        const old = await db.categories.findOne({ id: input.id });
        await db.categories.update({ id: input.id, record: { name, sortOrder: input.sortOrder ?? old?.sortOrder ?? 0 } });
        if (old?.name && old.name !== name) {
          const { records } = await db.products.findAll({ filters: { category: old.name }, limit: 2000 });
          for (const p of records) await db.products.update({ id: p.id, record: { category: name } });
        }
      } else {
        await db.categories.create({ record: { name, sortOrder: input.sortOrder ?? 99 } });
      }
    }
    if (input.action === 'delete' && input.id) await db.categories.delete({ id: input.id });

    const [{ records }, counts] = await Promise.all([
      db.categories.findAll({ sort: [{ field: 'sortOrder', direction: 'asc' }], limit: 500 }),
      db.sql({ query: `SELECT "category", COUNT(*) AS "n" FROM "Products" GROUP BY "category"` }),
    ]);
    const byName = new Map(counts.rows.map((r) => [String(r.category), Number(r.n)]));
    return {
      categories: records.map((c) => ({ id: c.id, name: c.name ?? '', sortOrder: c.sortOrder ?? 0, productCount: byName.get(c.name ?? '') ?? 0 })),
    };
  },
});
