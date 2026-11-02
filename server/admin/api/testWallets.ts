import { z } from 'zod';
import { createEndpoint } from '../../core/endpoint.js';
import { testWallets } from '../lib/server/crypto.js';

export default createEndpoint({
  description: 'Checks that each configured payment wallet can be watched through its blockchain API',
  inputSchema: z.object({}),
  outputSchema: z.object({ results: z.array(z.object({ currency: z.string(), ok: z.boolean(), message: z.string() })) }),
  execute: async () => ({ results: await testWallets() }),
});
