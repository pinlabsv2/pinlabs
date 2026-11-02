import { z } from 'zod';
import { createEndpoint } from '../../core/endpoint.js';
import { db } from '../../core/db.js';

const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1), description: z.string(), price: z.number().min(0), salePrice: z.number().nullable(),
  size: z.string(), purity: z.string(), category: z.string(), imageUrl: z.string(), stock: z.number().nullable(),
  active: z.boolean(), featured: z.boolean(), coaUrl: z.string(), showCoa: z.boolean(),
});

export default createEndpoint({
  description: 'Lists, creates, updates or deletes catalog products',
  inputSchema: z.object({
    action: z.enum(['list', 'save', 'delete']),
    product: productSchema.optional(),
    id: z.string().optional(),
  }),
  outputSchema: z.object({ products: z.array(productSchema.extend({ id: z.string() })), images: z.array(z.string()) }),
  execute: async ({ input }) => {
    if (input.action === 'save' && input.product) {
      const { id, ...rest } = input.product;
      const sale = rest.salePrice != null && rest.salePrice > 0 && rest.salePrice < rest.price ? rest.salePrice : null;
      const record = { ...rest, salePrice: sale, imageUrl: rest.imageUrl || null, coaUrl: rest.coaUrl || null };
      if (id) await db.products.update({ id, record });
      else await db.products.create({ record });
    }
    if (input.action === 'delete' && input.id) await db.products.delete({ id: input.id });
    const { records } = await db.products.findAll({ sort: [{ field: 'name', direction: 'asc' }], limit: 2000 });
    return {
      products: records.map((p) => ({
        id: p.id, name: p.name ?? '', description: p.description ?? '', price: p.price ?? 0,
        salePrice: typeof p.salePrice === 'number' ? p.salePrice : null, size: p.size ?? '',
        purity: p.purity ?? '', category: p.category ?? '', imageUrl: p.imageUrl ?? '',
        stock: typeof p.stock === 'number' ? p.stock : null, active: !!p.active, featured: !!p.featured,
        coaUrl: p.coaUrl ?? '', showCoa: !!p.showCoa,
      })),
      images: [...new Set(records.map((p) => p.imageUrl).filter((u): u is string => !!u))],
    };
  },
});
