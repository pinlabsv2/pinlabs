import { handle } from '../server/handler';

export const config = { maxDuration: 30, api: { bodyParser: false } };

const readRawBody = async (req: any): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
};

export default async function handler(req: any, res: any) {
  const rawBody = await readRawBody(req);
  let body: unknown = {};
  try { body = rawBody.length ? JSON.parse(rawBody.toString('utf8')) : {}; } catch { body = {}; }
  const query = Object.fromEntries(Object.entries(req.query ?? {}).map(([key, value]) => [key, Array.isArray(value) ? String(value[0] ?? '') : value == null ? undefined : String(value)]));
  const requestId = Array.isArray(req.headers?.['x-request-id']) ? req.headers['x-request-id'][0] : req.headers?.['x-request-id'];
  const result = await handle({
    name: String(query.name ?? ''),
    method: req.method,
    body,
    rawBody,
    headers: req.headers ?? {},
    cookie: req.headers?.cookie,
    query,
    requestId,
    ip: req.socket?.remoteAddress,
  });
  res.status(result.status);
  for (const [key, value] of Object.entries(result.headers)) res.setHeader(key, value);
  res.end(result.body);
}
