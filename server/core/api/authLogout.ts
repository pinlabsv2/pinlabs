import { z } from 'zod';
import { createEndpoint } from '../endpoint.js';
import { clearCookie } from '../auth.js';

export default createEndpoint({
  description: 'Signs out',
  inputSchema: z.object({}),
  execute: async ({ context }) => { context.setCookies.push(clearCookie()); return { ok: true }; },
});
