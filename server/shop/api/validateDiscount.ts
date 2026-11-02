import { z } from 'zod';
import { createEndpoint } from '../../core/endpoint';
import { evaluateCode } from '../lib/server/store';

export default createEndpoint({
  description: 'Checks a discount code against a cart subtotal',
  inputSchema: z.object({ code: z.string(), subtotal: z.number() }),
  outputSchema: z.object({ valid: z.boolean(), discount: z.number(), label: z.string(), message: z.string() }),
  execute: async ({ input }) => {
    try {
      const r = await evaluateCode(input.code, input.subtotal);
      return { valid: true, discount: r.discount, label: r.label, message: `${r.record.code} applied — ${r.label}` };
    } catch (e) {
      return { valid: false, discount: 0, label: '', message: (e as Error).message };
    }
  },
});
