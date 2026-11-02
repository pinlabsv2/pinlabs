import { z } from 'zod';
import { createEndpoint, type SessionUser } from '../endpoint';

export default createEndpoint({
  description: 'Returns the signed-in user, or null',
  inputSchema: z.object({}),
  execute: async ({ context }) => ({ user: (context.user ?? null) as SessionUser | null }),
});
