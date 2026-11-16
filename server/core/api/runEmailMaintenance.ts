import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { AppError, createEndpoint } from '../endpoint.js';
import { runEmailMaintenance } from '../email/worker.js';

function authorized(value: string | string[] | undefined, secret: string) {
  const header = Array.isArray(value) ? value[0] : value;
  const actual = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(actual);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default createEndpoint({
  description: 'Processes a bounded batch of queued email',
  methods: ['GET', 'POST'],
  inputSchema: z.object({}),
  outputSchema: z.object({ leased: z.number(), sent: z.number(), suppressed: z.number(), retried: z.number(), failed: z.number() }),
  execute: async ({ context }) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new Error('CRON_SECRET is not configured');
    if (!authorized(context.request.headers.authorization, secret)) {
      throw new AppError({ code: 'UNAUTHORIZED', message: 'Invalid maintenance authorization', userFacingMessage: 'Unauthorized.' });
    }
    return runEmailMaintenance({ limit: 20 });
  },
});
