import type { QueryRunner } from '../pg.js';
import { cancelOrderEmails, enqueueTemplate } from './enqueue.js';

type OrderEmailData = {
  id: string;
  orderNumber?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  total?: number | null;
  cryptoAmount?: number | null;
  payCurrency?: string | null;
  paymentExpiresAt?: string | null;
  trackingNumber?: string | null;
  status?: string | null;
};

function baseUrl() {
  const configured = process.env.PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (configured && /^https?:\/\//i.test(configured)) return configured;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim().replace(/\/$/, '');
  return vercel ? `https://${vercel}` : 'http://localhost:3000';
}

function values(order: OrderEmailData) {
  const name = String(order.customerName || '').trim();
  const root = baseUrl();
  return {
    'customer.firstName': name.split(/\s+/)[0] || 'there',
    'customer.name': name,
    'customer.email': String(order.customerEmail || ''),
    'order.number': String(order.orderNumber || ''),
    'order.total': `$${Number(order.total || 0).toFixed(2)}`,
    'order.cryptoAmount': String(order.cryptoAmount ?? ''),
    'order.payCurrency': String(order.payCurrency || ''),
    'order.paymentExpiresAt': order.paymentExpiresAt ? new Date(order.paymentExpiresAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC' : '',
    'order.trackingNumber': String(order.trackingNumber || ''),
    'order.status': String(order.status || ''),
    'order.url': `${root}/orders/${encodeURIComponent(order.id)}`,
    'order.adminUrl': `${root}/admin/orders`,
  };
}

async function adminEmail(tx: QueryRunner) {
  const { rows } = await tx.query(`SELECT "adminEmail" FROM "StoreSettings" ORDER BY "createdAt" LIMIT 1`);
  return typeof rows[0]?.adminEmail === 'string' ? rows[0].adminEmail.trim().toLowerCase() : '';
}

export async function enqueueOrderPlacedEmails(tx: QueryRunner, order: OrderEmailData) {
  const context = values(order);
  await enqueueTemplate(tx, {
    templateKey: 'order_placed', recipient: String(order.customerEmail || ''), values: context,
    purpose: 'order_placed', kind: 'transactional', orderId: order.id, idempotencyKey: `order:${order.id}:order_placed`,
  });
  if (order.paymentExpiresAt) {
    const dueAt = new Date(Math.max(Date.now(), new Date(order.paymentExpiresAt).getTime() - 30 * 60_000)).toISOString();
    await enqueueTemplate(tx, {
      templateKey: 'payment_due', recipient: String(order.customerEmail || ''), values: context,
      purpose: 'payment_due', kind: 'transactional', orderId: order.id, idempotencyKey: `order:${order.id}:payment_due`, dueAt,
    });
  }
  const admin = await adminEmail(tx);
  if (admin) await enqueueTemplate(tx, {
    templateKey: 'admin_order_placed', recipient: admin, values: context,
    purpose: 'admin_order_placed', kind: 'internal', orderId: order.id, idempotencyKey: `order:${order.id}:admin_order_placed`,
  });
}

export async function enqueuePaymentReceivedEmails(tx: QueryRunner, order: OrderEmailData) {
  await cancelOrderEmails(tx, order.id, ['payment_due'], 'payment_received');
  const context = values(order);
  await enqueueTemplate(tx, {
    templateKey: 'payment_received', recipient: String(order.customerEmail || ''), values: context,
    purpose: 'payment_received', kind: 'transactional', orderId: order.id, idempotencyKey: `order:${order.id}:payment_received`,
  });
  const admin = await adminEmail(tx);
  if (admin) await enqueueTemplate(tx, {
    templateKey: 'admin_payment_received', recipient: admin, values: context,
    purpose: 'admin_payment_received', kind: 'internal', orderId: order.id, idempotencyKey: `order:${order.id}:admin_payment_received`,
  });
}

export async function enqueueOrderStatusEmail(tx: QueryRunner, order: OrderEmailData, templateKey: 'order_shipped' | 'shipping_update' | 'order_refunded' | 'order_cancelled' | 'order_expired', transitionIdentity: string) {
  if (templateKey === 'order_cancelled' || templateKey === 'order_expired') await cancelOrderEmails(tx, order.id, ['payment_due'], templateKey);
  await enqueueTemplate(tx, {
    templateKey, recipient: String(order.customerEmail || ''), values: values(order), purpose: templateKey, kind: 'transactional', orderId: order.id,
    idempotencyKey: `order:${order.id}:${templateKey}:${transitionIdentity}`,
  });
}
