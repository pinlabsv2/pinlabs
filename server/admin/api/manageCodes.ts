import { z } from 'zod';
import { createEndpoint } from '../../core/endpoint.js';
import { db } from '../../core/db.js';

const commonCodeFields = {
  id: z.string().optional(),
  code: z.string().min(2),
  minimumOrder: z.number().min(0).nullable(),
  usageLimit: z.number().int().min(1).nullable(),
  timesUsed: z.number().int().min(0),
  expiresAt: z.string().nullable(),
  active: z.boolean(),
  note: z.string(),
};
const codeSchema = z.discriminatedUnion('discountType', [
  z.object({ ...commonCodeFields, discountType: z.literal('Percent'), amount: z.number().min(0).max(100) }),
  z.object({ ...commonCodeFields, discountType: z.literal('Fixed'), amount: z.number().min(0) }),
]);
const storedCodeSchema = z.object({ ...commonCodeFields, id: z.string(), discountType: z.enum(['Percent', 'Fixed']), amount: z.number().min(0) });

export default createEndpoint({
  description: 'Lists, creates, updates or deletes discount codes',
  inputSchema: z.object({ action: z.enum(['list', 'save', 'delete']), code: codeSchema.optional(), id: z.string().optional() }),
  outputSchema: z.object({ codes: z.array(storedCodeSchema) }),
  execute: async ({ input }) => {
    if (input.action === 'save' && input.code) {
      const { id, ...rest } = input.code;
      const record = { ...rest, code: rest.code.trim().toUpperCase() };
      if (id) await db.discountCodes.update({ id, record });
      else await db.discountCodes.create({ record });
    }
    if (input.action === 'delete' && input.id) await db.discountCodes.delete({ id: input.id });
    const { records } = await db.discountCodes.findAll({ sort: [{ field: 'code', direction: 'asc' }], limit: 2000 });
    return {
      codes: records.map((c) => ({
        id: c.id, code: c.code ?? '', discountType: (c.discountType === 'Fixed' ? 'Fixed' : 'Percent') as 'Percent' | 'Fixed',
        amount: c.amount ?? 0, minimumOrder: c.minimumOrder ?? null, usageLimit: c.usageLimit ?? null,
        timesUsed: c.timesUsed ?? 0, expiresAt: c.expiresAt ? String(c.expiresAt) : null, active: !!c.active, note: c.note ?? '',
      })),
    };
  },
});
