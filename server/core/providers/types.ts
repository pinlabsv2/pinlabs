export type ProviderMode = 'live' | 'sandbox' | 'fake';
export type PaymentState = 'creating' | 'creation_uncertain' | 'waiting' | 'partially_paid' | 'confirming' | 'confirmed' | 'sending' | 'finished' | 'expired' | 'failed';

export type CreatePaymentInput = {
  attemptId: string;
  orderId: string;
  priceCents: number;
  priceCurrency?: string;
  payCurrency: string;
  callbackUrl: string;
  description: string;
  fixedRate?: boolean;
  feePaidByUser?: boolean;
};
export type PaymentSnapshot = {
  providerPaymentId: string;
  providerOrderId: string;
  state: PaymentState;
  priceAmount: string;
  priceCurrency: string;
  payAmount: string;
  payCurrency: string;
  network?: string;
  payAddress: string;
  extraId?: string;
  actuallyPaid?: string;
  outcomeAmount?: string;
  outcomeCurrency?: string;
  purchaseId?: string;
  expiresAt?: string;
  payinHash?: string;
  payoutHash?: string;
  updatedAt?: string;
  raw: Record<string, unknown>;
};
export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<PaymentSnapshot>;
  getPayment(providerPaymentId: string): Promise<PaymentSnapshot>;
}

export type PayoutState = 'requested' | 'action_required' | 'processing' | 'succeeded' | 'failed';
export type PayoutDestination = { currency: string; network?: string; address: string; extraId?: string };
export type PayoutQuoteInput = PayoutDestination & { usdCents: number };
export type PayoutQuote = PayoutQuoteInput & {
  cryptoAmount: string;
  feeAmount?: string;
  recipientAmount?: string;
  expiresAt?: string;
  raw: Record<string, unknown>;
};
export type CreatePayoutInput = PayoutDestination & {
  intentId: string;
  cryptoAmount: string;
  callbackUrl: string;
  description: string;
};
export type PayoutSnapshot = CreatePayoutInput & {
  providerPayoutId: string;
  state: PayoutState;
  transactionHash?: string;
  error?: string;
  raw: Record<string, unknown>;
};
export interface PayoutProvider {
  validateDestination(destination: PayoutDestination): Promise<{ valid: boolean; message?: string; raw: Record<string, unknown> }>;
  quotePayout(input: PayoutQuoteInput): Promise<PayoutQuote>;
  createPayout(input: CreatePayoutInput): Promise<PayoutSnapshot>;
  getPayout(providerPayoutId: string): Promise<PayoutSnapshot>;
}

export type EmailMessage = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
};
export type EmailResult = { providerMessageId: string; raw: Record<string, unknown> };
export type BroadcastInput = EmailMessage & { name: string; segmentId: string };
export type BroadcastSnapshot = { providerBroadcastId: string; state: string; raw: Record<string, unknown> };
export interface EmailProvider {
  sendEmail(message: EmailMessage, idempotencyKey: string): Promise<EmailResult>;
  createBroadcast(input: BroadcastInput, idempotencyKey: string): Promise<BroadcastSnapshot>;
  sendBroadcast(providerBroadcastId: string, scheduledAt?: string): Promise<BroadcastSnapshot>;
  getBroadcast(providerBroadcastId: string): Promise<BroadcastSnapshot>;
}

export type TrackingSnapshot = {
  number: string;
  carrier?: string;
  status?: string;
  events: Array<{ id?: string; time: string; description: string; location?: string }>;
  raw: Record<string, unknown>;
};
export interface TrackingProvider {
  register(number: string): Promise<void>;
  get(number: string): Promise<TrackingSnapshot>;
}

export type StoredObject = { key: string; url: string; downloadUrl?: string; contentType: string; size: number };
export interface ReviewImageStorage {
  putObject(key: string, bytes: Uint8Array, contentType: string): Promise<StoredObject>;
  readObject(object: StoredObject): Promise<Uint8Array>;
  deleteObject(object: StoredObject): Promise<void>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
    readonly retryable = false,
  ) { super(message); }
}
