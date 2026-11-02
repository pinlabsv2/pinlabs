import { z } from 'zod';
import { createEndpoint } from '../endpoint';
import { clearCookie } from '../auth';

export default createEndpoint({
  description: 'Signs out',
  inputSchema: z.object({}),
  execute: async ({ context }) => { context.setCookies.push(clearCookie()); return { ok: true }; },
});
