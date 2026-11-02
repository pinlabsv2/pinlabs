import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { db } from './db';
import type { SessionUser } from './endpoint';

const COOKIE = 'pl_session';
const MAX_AGE = 60 * 60 * 24 * 30;
function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.VERCEL) throw new Error('AUTH_SECRET is not set');
  return new TextEncoder().encode(s || 'dev-only-insecure-secret-change-me');
}

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const checkPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function sessionCookie(userId: string) {
  const token = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(secret());
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${process.env.NODE_ENV === 'production' || process.env.VERCEL ? '; Secure' : ''}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

function readCookie(header: string | undefined) {
  const m = (header ?? '').split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  return m?.slice(COOKIE.length + 1);
}

/** Admin emails from env (comma separated) always get the admin role. */
export function isAdminEmail(email: string) {
  return (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}

export function toSessionUser(u: { id: string; email?: string; firstName?: string; lastName?: string; role?: string }): SessionUser {
  return { id: u.id, email: u.email ?? '', firstName: u.firstName, lastName: u.lastName, role: u.role === 'admin' || isAdminEmail(u.email ?? '') ? 'admin' : 'customer' };
}

export async function userFromCookie(header: string | undefined): Promise<SessionUser | null> {
  const token = readCookie(header);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const u = payload.sub ? await db.users.findOne({ id: payload.sub }) : undefined;
    return u ? toSessionUser(u) : null;
  } catch { return null; }
}
