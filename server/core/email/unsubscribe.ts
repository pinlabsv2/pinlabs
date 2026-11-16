import { createHmac, timingSafeEqual } from 'node:crypto';

const purpose = 'marketing-unsubscribe-v1';

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value && process.env.VERCEL) throw new Error('AUTH_SECRET is not set');
  return value || 'dev-only-insecure-secret-change-me';
}

function signature(payload: string) {
  return createHmac('sha256', secret()).update(`${purpose}.${payload}`).digest('base64url');
}

export function createUnsubscribeToken(contactId: string) {
  const payload = Buffer.from(JSON.stringify({ p: purpose, c: contactId, v: 1 }), 'utf8').toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function verifyUnsubscribeToken(token: string) {
  const [payload, supplied, extra] = token.split('.');
  if (!payload || !supplied || extra) return null;
  const expected = signature(payload);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    return value.p === purpose && value.v === 1 && typeof value.c === 'string' && value.c ? value.c : null;
  } catch {
    return null;
  }
}
