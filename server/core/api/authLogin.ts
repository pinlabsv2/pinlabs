import { z } from 'zod';
import { createEndpoint, AppError } from '../endpoint.js';
import { db } from '../db.js';
import { checkPassword, sessionCookie, toSessionUser } from '../auth.js';

export default createEndpoint({
  description: 'Signs in with email + password',
  inputSchema: z.object({ email: z.string(), password: z.string() }),
  execute: async ({ input, context }) => {
    const u = await db.users.findOne({ filters: { email: input.email.trim().toLowerCase() } });
    if (!u?.passwordHash || !(await checkPassword(input.password, u.passwordHash))) {
      throw new AppError({ code: 'UNAUTHORIZED', message: 'Bad credentials', userFacingMessage: 'Wrong email or password.' });
    }
    context.setCookies.push(await sessionCookie(u.id));
    return { user: toSessionUser(u) };
  },
});
