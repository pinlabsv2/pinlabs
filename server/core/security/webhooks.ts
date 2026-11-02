import { createHmac, timingSafeEqual } from 'node:crypto';
import type { RequestHeaders } from '../endpoint';

export const headerValue = (headers: RequestHeaders, name: string): string | undefined => {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

export const sortJsonKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortJsonKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, sortJsonKeys((value as Record<string, unknown>)[key])]));
};

const equalBytes = (left: Buffer, right: Buffer) => left.length === right.length && timingSafeEqual(left, right);

export function verifyNowPaymentsSignature(payload: unknown, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac('sha512', secret).update(JSON.stringify(sortJsonKeys(payload))).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, 'hex'); } catch { return false; }
  return equalBytes(expected, actual);
}

export function verifySvixSignature(input: {
  rawBody: Uint8Array;
  id?: string;
  timestamp?: string;
  signature?: string;
  secret: string;
  now?: number;
  toleranceSeconds?: number;
}): boolean {
  if (!input.id || !input.timestamp || !input.signature || !input.secret) return false;
  const timestamp = Number(input.timestamp);
  if (!Number.isInteger(timestamp)) return false;
  const now = input.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > (input.toleranceSeconds ?? 300)) return false;
  let key: Buffer;
  try { key = Buffer.from(input.secret.startsWith('whsec_') ? input.secret.slice(6) : input.secret, 'base64'); } catch { return false; }
  const signed = `${input.id}.${input.timestamp}.${Buffer.from(input.rawBody).toString('utf8')}`;
  const expected = createHmac('sha256', key).update(signed).digest();
  return input.signature.split(/\s+/).some((part) => {
    const [version, encoded] = part.split(',', 2);
    if (version !== 'v1' || !encoded) return false;
    try { return equalBytes(expected, Buffer.from(encoded, 'base64')); } catch { return false; }
  });
}
