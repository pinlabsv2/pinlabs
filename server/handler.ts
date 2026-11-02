import { timingSafeEqual } from 'node:crypto';
import { endpoints } from './registry.js';
import { AppError, type Context, type RequestHeaders } from './core/endpoint.js';
import { userFromCookie } from './core/auth.js';
import { db } from './core/db.js';

export type HttpRequest = {
  name: string;
  method: string;
  body: unknown;
  rawBody?: Uint8Array;
  headers?: RequestHeaders;
  cookie?: string;
  query: Record<string, string | undefined>;
  requestId?: string;
  ip?: string;
};
export type HttpResult = { status: number; headers: Record<string, string | string[]>; body: string | Uint8Array };
const json = (status: number, data: unknown, headers: Record<string, string | string[]> = {}): HttpResult =>
  ({ status, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });
const sameSecret = (actual: string | undefined, expected: string) => {
  if (typeof actual !== 'string') return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};
const normalizeHeaders = (headers: RequestHeaders = {}): RequestHeaders =>
  Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));

export async function handle(req: HttpRequest): Promise<HttpResult> {
  try {
    const method = String(req.method || 'GET').toUpperCase();
    const headers = normalizeHeaders(req.headers);
    if (req.name === 'file') {
      if (method !== 'GET') return json(405, { message: 'Use GET' }, { Allow: 'GET' });
      const f = req.query.id ? await db.files.findOne({ id: req.query.id }) : undefined;
      if (!f?.dataBase64) return json(404, { message: 'Not found' });
      return { status: 200, headers: { 'Content-Type': f.mimeType ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable' }, body: Buffer.from(f.dataBase64, 'base64') };
    }

    const entry = (endpoints as Record<string, { endpoint: any; adminOnly: boolean }>)[req.name];
    if (!entry) return json(404, { message: 'Unknown endpoint' });
    const ep = entry.endpoint;
    const methods = (ep.methods?.length ? ep.methods : ['POST']).map((value: string) => value.toUpperCase());
    if (!methods.includes(method)) return json(405, { message: `Use ${methods.join(' or ')}` }, { Allow: methods.join(', ') });

    const user = await userFromCookie(req.cookie);
    if (ep.webhook && (ep.webhook.provider ?? 'track17') === 'track17') {
      const secret = process.env.TRACK17_WEBHOOK_SECRET;
      if (!secret) return json(503, { message: 'Webhook secret is not configured.' });
      if (!sameSecret(req.query.secret, secret)) return json(401, { message: 'Invalid webhook secret.' });
    }
    if ((ep.authenticated || entry.adminOnly) && !user) return json(401, { message: 'Please sign in.' });
    if (entry.adminOnly && user?.role !== 'admin') return json(403, { message: 'Admins only.' });

    const parsed = ep.inputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return json(400, { message: `Invalid input: ${issue.path.join('.')} – ${issue.message}`, issues: parsed.error.issues });
    }
    const context = {
      user,
      setCookies: [],
      request: {
        method,
        headers,
        rawBody: req.rawBody ?? new Uint8Array(),
        query: req.query,
        requestId: req.requestId,
        ip: req.ip,
      },
    } as unknown as Context;
    const result = await ep.execute({ input: parsed.data, context });
    return json(200, result ?? null, context.setCookies.length ? { 'Set-Cookie': context.setCookies } : {});
  } catch (error: unknown) {
    if (error instanceof AppError) {
      const message = error.userFacingMessage ?? (error.status < 500 ? error.message : 'Internal server error.');
      return json(error.status, { message });
    }
    console.error(`[api/${req.name}]`, error);
    return json(500, { message: 'Internal server error.' });
  }
}
