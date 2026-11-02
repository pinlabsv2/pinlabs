import { z } from 'zod';
import type { OrdersRecordType } from '../../../core/db.js';

export const orderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  createdAt: z.string().nullable(),
  customerName: z.string(),
  customerEmail: z.string(),
  shippingAddress: z.string(),
  items: z.array(z.object({ productId: z.string(), name: z.string(), price: z.number(), quantity: z.number() })),
  subtotal: z.number(),
  discount: z.number(),
  shipping: z.number(),
  total: z.number(),
  discountCode: z.string(),
  payCurrency: z.string(),
  cryptoAmount: z.number(),
  payAddress: z.string(),
  transactionHash: z.string(),
  paymentExpiresAt: z.string().nullable(),
  paidAt: z.string().nullable(),
  status: z.string(),
  trackingNumber: z.string(),
  carrier: z.string(),
  trackingStatus: z.string(),
  trackingEvents: z.array(z.object({ time: z.string(), description: z.string(), location: z.string() })),
  lastTrackingCheck: z.string().nullable(),
});

const s = (v: unknown) => (v == null ? null : String(v));

export function toOrder(o: OrdersRecordType): z.infer<typeof orderSchema> {
  const parse = (j?: string) => { try { return j ? JSON.parse(j) : []; } catch { return []; } };
  return {
    id: o.id,
    orderNumber: o.orderNumber ?? '',
    createdAt: s(o.placedAt),
    customerName: o.customerName ?? '',
    customerEmail: o.customerEmail ?? '',
    shippingAddress: o.shippingAddress ?? '',
    items: parse(o.itemsJson),
    subtotal: o.subtotal ?? 0,
    discount: o.discount ?? 0,
    shipping: o.shipping ?? 0,
    total: o.total ?? 0,
    discountCode: o.discountCode ?? '',
    payCurrency: o.payCurrency ?? '',
    cryptoAmount: o.cryptoAmount ?? 0,
    payAddress: o.payAddress ?? '',
    transactionHash: o.transactionHash ?? '',
    paymentExpiresAt: s(o.paymentExpiresAt),
    paidAt: s(o.paidAt),
    status: o.status ?? '',
    trackingNumber: o.trackingNumber ?? '',
    carrier: o.carrier ?? '',
    trackingStatus: o.trackingStatus ?? '',
    trackingEvents: parse(o.trackingEventsJson),
    lastTrackingCheck: s(o.lastTrackingCheck),
  };
}
