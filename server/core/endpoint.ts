import type { z } from 'zod';

export type SessionUser = { id: string; email: string; firstName?: string; lastName?: string; role: 'admin' | 'customer' };
export type RequestHeaders = Record<string, string | string[] | undefined>;
export type RequestContext = {
  method: string;
  headers: RequestHeaders;
  rawBody: Uint8Array;
  query: Record<string, string | undefined>;
  requestId?: string;
  ip?: string;
};
export type Context = {
  user: SessionUser;
  setCookies: string[];
  request: RequestContext;
};

export type ErrorCode = 'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'INTERNAL_ERROR' | string;
const STATUS: Record<string, number> = { BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404 };

export class AppError extends Error {
  code: ErrorCode; userFacingMessage?: string; status: number;
  constructor(o: { code: ErrorCode; message: string; userFacingMessage?: string }) {
    super(o.message); this.code = o.code; this.userFacingMessage = o.userFacingMessage; this.status = STATUS[o.code] ?? 500;
  }
}

export type WebhookProvider = 'track17' | 'nowpayments' | 'resend';
export type Endpoint<I extends z.ZodTypeAny, O> = {
  description?: string;
  authenticated?: boolean;
  webhook?: { provider?: WebhookProvider };
  methods?: readonly string[];
  inputSchema: I;
  outputSchema?: z.ZodTypeAny;
  execute: (args: { input: z.infer<I>; context: Context }) => Promise<O>;
};

export function createEndpoint<I extends z.ZodTypeAny, O>(cfg: Endpoint<I, O>) { return cfg; }
