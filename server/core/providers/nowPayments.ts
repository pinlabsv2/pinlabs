import { ProviderError, type CreatePaymentInput, type CreatePayoutInput, type PaymentProvider, type PaymentSnapshot, type PaymentState, type PayoutDestination, type PayoutProvider, type PayoutQuote, type PayoutQuoteInput, type PayoutSnapshot, type PayoutState } from './types';

const paymentStates = new Set<PaymentState>(['waiting', 'partially_paid', 'confirming', 'confirmed', 'sending', 'finished', 'expired', 'failed']);
const asObject = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const text = (value: unknown) => value == null ? '' : String(value);
const optional = (value: unknown) => value == null || value === '' ? undefined : String(value);

const requestJson = async (url: string, init: RequestInit): Promise<Record<string, unknown>> => {
  let response: Response;
  try { response = await fetch(url, init); }
  catch (error) { throw new ProviderError(error instanceof Error ? error.message : 'Provider request failed', 'network_error', undefined, true); }
  const body = asObject(await response.json().catch(() => ({})));
  if (!response.ok) throw new ProviderError(text(body.message || body.error || `Provider request failed (${response.status})`), 'provider_error', response.status, response.status === 429 || response.status >= 500);
  return body;
};

const normalizePayment = (raw: Record<string, unknown>): PaymentSnapshot => {
  const providerStatus = text(raw.payment_status || 'waiting') as PaymentState;
  return {
    providerPaymentId: text(raw.payment_id),
    providerOrderId: text(raw.order_id),
    state: paymentStates.has(providerStatus) ? providerStatus : 'waiting',
    priceAmount: text(raw.price_amount),
    priceCurrency: text(raw.price_currency),
    payAmount: text(raw.pay_amount),
    payCurrency: text(raw.pay_currency),
    network: optional(raw.network),
    payAddress: text(raw.pay_address),
    extraId: optional(raw.payin_extra_id),
    actuallyPaid: optional(raw.actually_paid),
    outcomeAmount: optional(raw.outcome_amount),
    outcomeCurrency: optional(raw.outcome_currency),
    purchaseId: optional(raw.purchase_id),
    expiresAt: optional(raw.valid_until || raw.expiration_estimate_date),
    payinHash: optional(raw.payin_hash),
    payoutHash: optional(raw.payout_hash),
    updatedAt: optional(raw.updated_at),
    raw,
  };
};

const normalizePayoutState = (value: unknown): PayoutState => {
  const state = text(value).toLowerCase();
  if (state === 'finished' || state === 'succeeded' || state === 'success') return 'succeeded';
  if (state === 'rejected') return 'failed';
  if (state === 'failed') return 'processing';
  if (state.includes('verify') || state.includes('confirm') || state.includes('waiting')) return 'action_required';
  return 'processing';
};

export class NowPaymentsProvider implements PaymentProvider, PayoutProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private payoutToken?: { value: string; expiresAt: number };

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.baseUrl = (env.NOWPAYMENTS_API_BASE_URL || 'https://api.nowpayments.io').replace(/\/$/, '');
    this.apiKey = env.NOWPAYMENTS_API_KEY || '';
  }

  private apiHeaders(extra: Record<string, string> = {}) {
    if (!this.apiKey) throw new ProviderError('NOWPayments API key is not configured', 'not_configured');
    return { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, ...extra };
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentSnapshot> {
    const raw = await requestJson(`${this.baseUrl}/v1/payment`, {
      method: 'POST',
      headers: this.apiHeaders(),
      body: JSON.stringify({
        price_amount: (input.priceCents / 100).toFixed(2),
        price_currency: (input.priceCurrency || 'usd').toLowerCase(),
        pay_currency: input.payCurrency.toLowerCase(),
        ipn_callback_url: input.callbackUrl,
        order_id: input.attemptId,
        order_description: input.description,
        is_fixed_rate: !!input.fixedRate,
        is_fee_paid_by_user: !!input.feePaidByUser,
      }),
    });
    return normalizePayment(raw);
  }

  async getPayment(providerPaymentId: string): Promise<PaymentSnapshot> {
    return normalizePayment(await requestJson(`${this.baseUrl}/v1/payment/${encodeURIComponent(providerPaymentId)}`, { headers: this.apiHeaders() }));
  }

  private async payoutAuth(): Promise<string> {
    if (this.payoutToken && this.payoutToken.expiresAt > Date.now()) return this.payoutToken.value;
    const email = process.env.NOWPAYMENTS_PAYOUT_EMAIL;
    const password = process.env.NOWPAYMENTS_PAYOUT_PASSWORD;
    if (!email || !password) throw new ProviderError('NOWPayments payout credentials are not configured', 'not_configured');
    const raw = await requestJson(`${this.baseUrl}/v1/auth`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    });
    const token = text(raw.token);
    if (!token) throw new ProviderError('NOWPayments did not return a payout token', 'invalid_response');
    this.payoutToken = { value: token, expiresAt: Date.now() + 4 * 60_000 };
    return token;
  }

  private async payoutHeaders() {
    return this.apiHeaders({ Authorization: `Bearer ${await this.payoutAuth()}` });
  }

  async validateDestination(destination: PayoutDestination) {
    const raw = await requestJson(`${this.baseUrl}/v1/payout/validate-address`, {
      method: 'POST', headers: await this.payoutHeaders(),
      body: JSON.stringify({ address: destination.address, currency: destination.currency.toLowerCase(), extra_id: destination.extraId }),
    });
    return { valid: raw.result !== false && raw.valid !== false, message: optional(raw.message), raw };
  }

  async quotePayout(input: PayoutQuoteInput): Promise<PayoutQuote> {
    const params = new URLSearchParams({ amount: (input.usdCents / 100).toFixed(2), currency_from: 'usd', currency_to: input.currency.toLowerCase() });
    const raw = await requestJson(`${this.baseUrl}/v1/estimate?${params}`, { headers: this.apiHeaders() });
    return { ...input, cryptoAmount: text(raw.estimated_amount || raw.amount), raw };
  }

  async createPayout(input: CreatePayoutInput): Promise<PayoutSnapshot> {
    const raw = await requestJson(`${this.baseUrl}/v1/payout`, {
      method: 'POST', headers: await this.payoutHeaders(),
      body: JSON.stringify({
        ipn_callback_url: input.callbackUrl,
        withdrawals: [{
          address: input.address,
          currency: input.currency.toLowerCase(),
          amount: input.cryptoAmount,
          extra_id: input.extraId,
          unique_external_id: input.intentId,
          description: input.description,
        }],
      }),
    });
    const withdrawal = asObject(Array.isArray(raw.withdrawals) ? raw.withdrawals[0] : raw);
    return {
      ...input,
      providerPayoutId: text(withdrawal.id || withdrawal.batch_withdrawal_id || raw.id),
      state: normalizePayoutState(withdrawal.status || raw.status),
      transactionHash: optional(withdrawal.hash || withdrawal.txid),
      error: optional(withdrawal.error || raw.message),
      raw,
    };
  }

  async getPayout(providerPayoutId: string): Promise<PayoutSnapshot> {
    const raw = await requestJson(`${this.baseUrl}/v1/payout/${encodeURIComponent(providerPayoutId)}`, { headers: await this.payoutHeaders() });
    const withdrawal = asObject(Array.isArray(raw.withdrawals) ? raw.withdrawals[0] : raw);
    return {
      intentId: text(withdrawal.unique_external_id),
      providerPayoutId,
      state: normalizePayoutState(withdrawal.status || raw.status),
      currency: text(withdrawal.currency),
      address: text(withdrawal.address),
      cryptoAmount: text(withdrawal.amount),
      callbackUrl: text(raw.ipn_callback_url),
      description: text(withdrawal.description),
      extraId: optional(withdrawal.extra_id),
      transactionHash: optional(withdrawal.hash || withdrawal.txid),
      error: optional(withdrawal.error || raw.message),
      raw,
    };
  }
}
