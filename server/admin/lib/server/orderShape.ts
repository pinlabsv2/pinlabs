import { z } from 'zod';
import type { OrdersRecordType } from '../../../core/db.js';

const itemSchema = z.object({
  preorderEnabled: z.boolean(), preorderExpectedShipAt: z.string().nullable(),
  productId: z.string(),
  productName: z.string(),
  variantId: z.string().nullable(),
  variantName: z.string(),
  name: z.string(),
  price: z.number(),
  quantity: z.number(),
  shippingOptionId: z.string().nullable(),
  shippingOptionName: z.string(),
  shippingOptionPrice: z.number(),
});

const shippingBreakdownSchema = z.object({
  shippingOptionId: z.string(),
  name: z.string(),
  price: z.number(),
});

export const orderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  createdAt: z.string().nullable(),
  customerName: z.string(),
  customerEmail: z.string(),
  shippingAddress: z.string(),
  items: z.array(itemSchema),
  shippingBreakdown: z.array(shippingBreakdownSchema),
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

const s = (value: unknown) => value == null ? null : String(value);
const n = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};
const parseArray = (value: unknown): Array<Record<string, unknown>> => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object') : [];
  } catch {
    return [];
  }
};

export function toOrder(order: OrdersRecordType): z.infer<typeof orderSchema> {
  const items = parseArray(order.itemsJson).map((item) => ({
    preorderEnabled: item.preorderEnabled === true, preorderExpectedShipAt: item.preorderExpectedShipAt ? String(item.preorderExpectedShipAt) : null,
    productId: String(item.productId ?? ''),
    productName: String(item.productName ?? item.name ?? ''),
    variantId: item.variantId == null || item.variantId === '' ? null : String(item.variantId),
    variantName: String(item.variantName ?? ''),
    name: String(item.name ?? item.productName ?? ''),
    price: n(item.price ?? item.unitPrice),
    quantity: n(item.quantity),
    shippingOptionId: item.shippingOptionId == null || item.shippingOptionId === '' ? null : String(item.shippingOptionId),
    shippingOptionName: String(item.shippingOptionName ?? ''),
    shippingOptionPrice: n(item.shippingOptionPrice ?? (n(item.shippingOptionPriceCents) / 100)),
  }));
  const shippingBreakdown = parseArray(order.shippingBreakdownJson).map((item) => ({
    shippingOptionId: String(item.shippingOptionId ?? item.id ?? ''),
    name: String(item.name ?? ''),
    price: n(item.price ?? (n(item.priceCents) / 100)),
  }));
  return {
    id: order.id,
    orderNumber: order.orderNumber ?? '',
    createdAt: s(order.placedAt),
    customerName: order.customerName ?? '',
    customerEmail: order.customerEmail ?? '',
    shippingAddress: order.shippingAddress ?? '',
    items,
    shippingBreakdown,
    subtotal: order.subtotal ?? n(order.subtotalCents) / 100,
    discount: order.discount ?? n(order.discountCents) / 100,
    shipping: order.shipping ?? n(order.shippingCents) / 100,
    total: order.total ?? n(order.totalCents) / 100,
    discountCode: order.discountCode ?? '',
    payCurrency: order.payCurrency ?? '',
    cryptoAmount: order.cryptoAmount ?? 0,
    payAddress: order.payAddress ?? '',
    transactionHash: order.transactionHash ?? '',
    paymentExpiresAt: s(order.paymentExpiresAt),
    paidAt: s(order.paidAt),
    status: order.status ?? '',
    trackingNumber: order.trackingNumber ?? '',
    carrier: order.carrier ?? '',
    trackingStatus: order.trackingStatus ?? '',
    trackingEvents: parseArray(order.trackingEventsJson).map((event) => ({
      time: String(event.time ?? ''), description: String(event.description ?? ''), location: String(event.location ?? ''),
    })),
    lastTrackingCheck: s(order.lastTrackingCheck),
  };
}
