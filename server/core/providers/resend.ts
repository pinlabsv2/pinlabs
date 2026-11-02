import { ProviderError, type BroadcastInput, type BroadcastSnapshot, type EmailMessage, type EmailProvider, type EmailResult } from './types';

const asObject = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const requestJson = async (url: string, init: RequestInit): Promise<Record<string, unknown>> => {
  let response: Response;
  try { response = await fetch(url, init); }
  catch (error) { throw new ProviderError(error instanceof Error ? error.message : 'Email provider request failed', 'network_error', undefined, true); }
  const body = asObject(await response.json().catch(() => ({})));
  if (!response.ok) throw new ProviderError(String(body.message || `Email provider request failed (${response.status})`), 'provider_error', response.status, response.status === 429 || response.status >= 500);
  return body;
};

export class ResendProvider implements EmailProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.baseUrl = (env.RESEND_API_BASE_URL || 'https://api.resend.com').replace(/\/$/, '');
    this.apiKey = env.RESEND_API_KEY || '';
  }

  private headers(idempotencyKey?: string) {
    if (!this.apiKey) throw new ProviderError('Resend API key is not configured', 'not_configured');
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    };
  }

  async sendEmail(message: EmailMessage, idempotencyKey: string): Promise<EmailResult> {
    const raw = await requestJson(`${this.baseUrl}/emails`, {
      method: 'POST', headers: this.headers(idempotencyKey),
      body: JSON.stringify({
        from: message.from, to: message.to, subject: message.subject,
        html: message.html, text: message.text, reply_to: message.replyTo, headers: message.headers,
      }),
    });
    return { providerMessageId: String(raw.id || ''), raw };
  }

  async createBroadcast(input: BroadcastInput, idempotencyKey: string): Promise<BroadcastSnapshot> {
    const raw = await requestJson(`${this.baseUrl}/broadcasts`, {
      method: 'POST', headers: this.headers(idempotencyKey),
      body: JSON.stringify({
        name: input.name, segment_id: input.segmentId, from: input.from,
        subject: input.subject, html: input.html, text: input.text, reply_to: input.replyTo,
      }),
    });
    return { providerBroadcastId: String(raw.id || ''), state: String(raw.status || 'draft'), raw };
  }

  async sendBroadcast(providerBroadcastId: string, scheduledAt?: string): Promise<BroadcastSnapshot> {
    const raw = await requestJson(`${this.baseUrl}/broadcasts/${encodeURIComponent(providerBroadcastId)}/send`, {
      method: 'POST', headers: this.headers(), body: JSON.stringify(scheduledAt ? { scheduled_at: scheduledAt } : {}),
    });
    return { providerBroadcastId, state: String(raw.status || (scheduledAt ? 'scheduled' : 'sent')), raw };
  }

  async getBroadcast(providerBroadcastId: string): Promise<BroadcastSnapshot> {
    const raw = await requestJson(`${this.baseUrl}/broadcasts/${encodeURIComponent(providerBroadcastId)}`, { headers: this.headers() });
    return { providerBroadcastId, state: String(raw.status || 'unknown'), raw };
  }
}
