import type { BroadcastInput, BroadcastSnapshot, CreatePaymentInput, CreatePayoutInput, EmailMessage, EmailProvider, EmailResult, PaymentProvider, PaymentSnapshot, PaymentState, PayoutDestination, PayoutProvider, PayoutQuote, PayoutQuoteInput, PayoutSnapshot, PayoutState, ReviewImageStorage, StoredObject, TrackingProvider, TrackingSnapshot } from './types';

const clone = <T>(value: T): T => structuredClone(value);

export class FakePaymentProvider implements PaymentProvider {
  private sequence = 0;
  private readonly payments = new Map<string, PaymentSnapshot>();

  async createPayment(input: CreatePaymentInput): Promise<PaymentSnapshot> {
    const id = `fake-payment-${++this.sequence}`;
    const snapshot: PaymentSnapshot = {
      providerPaymentId: id,
      providerOrderId: input.attemptId,
      state: 'waiting',
      priceAmount: (input.priceCents / 100).toFixed(2),
      priceCurrency: input.priceCurrency || 'usd',
      payAmount: (input.priceCents / 100).toFixed(6),
      payCurrency: input.payCurrency.toLowerCase(),
      network: 'fake',
      payAddress: `fake:${id}`,
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      raw: { payment_id: id, payment_status: 'waiting' },
    };
    this.payments.set(id, snapshot);
    return clone(snapshot);
  }

  async getPayment(providerPaymentId: string): Promise<PaymentSnapshot> {
    const payment = this.payments.get(providerPaymentId);
    if (!payment) throw new Error(`Fake payment ${providerPaymentId} not found`);
    return clone(payment);
  }

  setState(providerPaymentId: string, state: PaymentState, patch: Partial<PaymentSnapshot> = {}) {
    const current = this.payments.get(providerPaymentId);
    if (!current) throw new Error(`Fake payment ${providerPaymentId} not found`);
    this.payments.set(providerPaymentId, { ...current, ...patch, state, raw: { ...current.raw, payment_status: state } });
  }
}

export class FakePayoutProvider implements PayoutProvider {
  private sequence = 0;
  private readonly payouts = new Map<string, PayoutSnapshot>();

  async validateDestination(destination: PayoutDestination) {
    const valid = destination.address.trim().length >= 8;
    return { valid, message: valid ? undefined : 'Address is too short', raw: { valid } };
  }

  async quotePayout(input: PayoutQuoteInput): Promise<PayoutQuote> {
    const cryptoAmount = (input.usdCents / 100).toFixed(6);
    return { ...input, cryptoAmount, feeAmount: '0.010000', recipientAmount: (Math.max(0, Number(cryptoAmount) - 0.01)).toFixed(6), expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(), raw: { fake: true } };
  }

  async createPayout(input: CreatePayoutInput): Promise<PayoutSnapshot> {
    const id = `fake-payout-${++this.sequence}`;
    const snapshot: PayoutSnapshot = { ...input, providerPayoutId: id, state: 'processing', raw: { id, status: 'processing' } };
    this.payouts.set(id, snapshot);
    return clone(snapshot);
  }

  async getPayout(providerPayoutId: string): Promise<PayoutSnapshot> {
    const payout = this.payouts.get(providerPayoutId);
    if (!payout) throw new Error(`Fake payout ${providerPayoutId} not found`);
    return clone(payout);
  }

  setState(providerPayoutId: string, state: PayoutState, patch: Partial<PayoutSnapshot> = {}) {
    const current = this.payouts.get(providerPayoutId);
    if (!current) throw new Error(`Fake payout ${providerPayoutId} not found`);
    this.payouts.set(providerPayoutId, { ...current, ...patch, state, raw: { ...current.raw, status: state } });
  }
}

export class CaptureEmailProvider implements EmailProvider {
  readonly messages: Array<{ message: EmailMessage; idempotencyKey: string; result: EmailResult }> = [];
  readonly broadcasts: Array<{ input: BroadcastInput; idempotencyKey: string; snapshot: BroadcastSnapshot }> = [];

  async sendEmail(message: EmailMessage, idempotencyKey: string): Promise<EmailResult> {
    const existing = this.messages.find((item) => item.idempotencyKey === idempotencyKey);
    if (existing) return clone(existing.result);
    const result = { providerMessageId: `fake-email-${this.messages.length + 1}`, raw: { captured: true } };
    this.messages.push({ message: clone(message), idempotencyKey, result });
    return clone(result);
  }

  async createBroadcast(input: BroadcastInput, idempotencyKey: string): Promise<BroadcastSnapshot> {
    const existing = this.broadcasts.find((item) => item.idempotencyKey === idempotencyKey);
    if (existing) return clone(existing.snapshot);
    const snapshot = { providerBroadcastId: `fake-broadcast-${this.broadcasts.length + 1}`, state: 'draft', raw: { captured: true } };
    this.broadcasts.push({ input: clone(input), idempotencyKey, snapshot });
    return clone(snapshot);
  }

  async sendBroadcast(providerBroadcastId: string, scheduledAt?: string): Promise<BroadcastSnapshot> {
    const item = this.broadcasts.find(({ snapshot }) => snapshot.providerBroadcastId === providerBroadcastId);
    if (!item) throw new Error(`Fake broadcast ${providerBroadcastId} not found`);
    item.snapshot = { ...item.snapshot, state: scheduledAt ? 'scheduled' : 'sent', raw: { ...item.snapshot.raw, scheduledAt } };
    return clone(item.snapshot);
  }

  async getBroadcast(providerBroadcastId: string): Promise<BroadcastSnapshot> {
    const item = this.broadcasts.find(({ snapshot }) => snapshot.providerBroadcastId === providerBroadcastId);
    if (!item) throw new Error(`Fake broadcast ${providerBroadcastId} not found`);
    return clone(item.snapshot);
  }
}

export class FakeTrackingProvider implements TrackingProvider {
  private readonly snapshots = new Map<string, TrackingSnapshot>();
  async register(number: string) {
    if (!this.snapshots.has(number)) this.snapshots.set(number, { number, status: 'InfoReceived', events: [], raw: { fake: true } });
  }
  async get(number: string) {
    const snapshot = this.snapshots.get(number);
    if (!snapshot) throw new Error(`Fake tracking ${number} not found`);
    return clone(snapshot);
  }
  set(snapshot: TrackingSnapshot) { this.snapshots.set(snapshot.number, clone(snapshot)); }
}

export class FakeReviewImageStorage implements ReviewImageStorage {
  private readonly objects = new Map<string, { object: StoredObject; bytes: Uint8Array }>();
  async putObject(key: string, bytes: Uint8Array, contentType: string): Promise<StoredObject> {
    const object = { key, url: `https://fake.blob.local/${encodeURIComponent(key)}`, contentType, size: bytes.byteLength };
    this.objects.set(key, { object, bytes: new Uint8Array(bytes) });
    return clone(object);
  }
  async readObject(object: StoredObject) {
    const stored = this.objects.get(object.key);
    if (!stored) throw new Error(`Fake object ${object.key} not found`);
    return new Uint8Array(stored.bytes);
  }
  async deleteObject(object: StoredObject) { this.objects.delete(object.key); }
  has(key: string) { return this.objects.has(key); }
}
