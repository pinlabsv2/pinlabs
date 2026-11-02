import { z } from 'zod';
import { createEndpoint, AppError } from '../endpoint';
import { db } from '../db';
import { hashPassword, sessionCookie, toSessionUser } from '../auth';

export default createEndpoint({
  description: 'Creates an account and signs in. The very first account becomes an admin.',
  inputSchema: z.object({ email: z.string().email(), password: z.string().min(8), firstName: z.string().optional(), lastName: z.string().optional() }),
  execute: async ({ input, context }) => {
    const email = input.email.trim().toLowerCase();
    const passwordHash = await hashPassword(input.password);
    try {
      const u = await db.transaction(async (tx) => {
        await tx.query(`SELECT "id" FROM "StoreSettings" ORDER BY "createdAt" LIMIT 1 FOR UPDATE`);
        const existing = await tx.query(`SELECT "id" FROM "Users" WHERE lower("email") = $1 LIMIT 1`, [email]);
        if (existing.rows[0]) {
          throw new AppError({ code: 'BAD_REQUEST', message: 'Email taken', userFacingMessage: 'An account with this email already exists. Sign in instead.' });
        }
        const { rows: admins } = await tx.query(`SELECT count(*)::int AS n FROM "Users" WHERE "role" = 'admin'`);
        const role = Number(admins[0]?.n) === 0 ? 'admin' : 'customer';
        const id = crypto.randomUUID();
        const { rows } = await tx.query(
          `INSERT INTO "Users" ("id", "email", "passwordHash", "firstName", "lastName", "role") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [id, email, passwordHash, input.firstName?.trim() ?? '', input.lastName?.trim() ?? '', role],
        );
        return rows[0];
      });
      context.setCookies.push(await sessionCookie(u.id));
      return { user: toSessionUser(u) };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      if (error?.code === '23505') {
        throw new AppError({ code: 'BAD_REQUEST', message: 'Email taken', userFacingMessage: 'An account with this email already exists. Sign in instead.' });
      }
      throw error;
    }
  },
});
