import { db } from '../../../core/db.js';
import type { OrdersRecordType } from '../../../core/db.js';
import { enqueueOrderStatusEmail } from '../../../core/email/orderEmails.js';

const API = (process.env.TRACK17_API_BASE_URL || 'https://api.17track.net/track/v2.4').replace(/\/$/, '');
export const ACTIVE_SHIPPING = ['Shipped', 'In Transit', 'Out for Delivery', 'Exception'];
const LOCKED = ['Cancelled', 'Refunded', 'Delivered'];

async function call(path: string, body: unknown) {
  const res = await fetch(`${API}/${path}`, {
    method: 'POST',
    headers: { '17token': process.env.TRACK17_API_KEY ?? '', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`17TRACK ${path} failed: ${res.status}`);
  return (await res.json()) as any;
}

export async function registerTracking(number: string) {
  if (!process.env.TRACK17_API_KEY) return false;
  await call('register', [{ number }]);
  return true;
}

export type TrackEvent = { time: string; description: string; location: string };

export function mapStatus(s: string | undefined): string | null {
  switch (s) {
    case 'InTransit': return 'In Transit';
    case 'OutForDelivery':
    case 'AvailableForPickup': return 'Out for Delivery';
    case 'Delivered': return 'Delivered';
    case 'Exception':
    case 'DeliveryFailure':
    case 'Expired': return 'Exception';
    default: return null; // NotFound / InfoReceived: keep "Shipped"
  }
}

function parseTrackInfo(info: any) {
  const status: string | undefined = info?.latest_status?.status;
  const providers: any[] = info?.tracking?.providers ?? [];
  const events: TrackEvent[] = providers.flatMap((p) =>
    (p.events ?? []).map((e: any) => ({
      time: e.time_iso ?? e.time_utc ?? '',
      description: e.description ?? '',
      location: e.location || [e.address?.city, e.address?.country].filter(Boolean).join(', '),
    })),
  ).sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  const carrier: string | undefined = providers[0]?.provider?.name;
  return { status, events, carrier };
}

/** Applies a 17TRACK track_info to every order with this tracking number. Returns true if any status moved. */
export async function applyTrackInfo(number: string, info: any): Promise<boolean> {
  const { records } = await db.orders.findAll({ filters: { trackingNumber: number }, limit: 50 });
  const { status, events, carrier } = parseTrackInfo(info);
  const newStatus = mapStatus(status);
  let any = false;
  for (const record of records) {
    const moved = await db.transaction(async (tx) => {
      const locked = await tx.query(`SELECT * FROM "Orders" WHERE "id" = $1 FOR UPDATE`, [record.id]);
      const order = locked.rows[0];
      if (!order) return false;
      const statusMoved = !!newStatus && newStatus !== order.status && !LOCKED.includes(String(order.status ?? ''));
      const updated = await tx.query(
        `UPDATE "Orders" SET "trackingStatus" = $2, "trackingEventsJson" = COALESCE($3, "trackingEventsJson"),
          "carrier" = COALESCE($4, "carrier"), "lastTrackingCheck" = now(),
          "status" = CASE WHEN $5::boolean THEN $6 ELSE "status" END, "updatedAt" = now()
         WHERE "id" = $1 RETURNING *`,
        [record.id, status ?? order.trackingStatus ?? null, events.length ? JSON.stringify(events) : null, carrier || null, statusMoved, newStatus],
      );
      if (statusMoved) {
        const identity = `${newStatus}:${events[0]?.time ?? ''}:${events[0]?.description ?? ''}`;
        await enqueueOrderStatusEmail(tx, updated.rows[0], 'shipping_update', identity);
      }
      return statusMoved;
    });
    if (moved) any = true;
  }
  return any;
}

export async function refreshTracking(numbers: string[]): Promise<number> {
  if (!process.env.TRACK17_API_KEY) return 0;
  let moved = 0;
  for (let i = 0; i < numbers.length; i += 40) {
    const batch = numbers.slice(i, i + 40);
    const data = await call('gettrackinfo', batch.map((number) => ({ number })));
    for (const a of data?.data?.accepted ?? []) {
      if (await applyTrackInfo(a.number, a.track_info)) moved++;
    }
    const rejected: string[] = (data?.data?.rejected ?? []).map((r: any) => r.number).filter(Boolean);
    if (rejected.length) await call('register', rejected.map((number) => ({ number }))).catch(() => null);
  }
  return moved;
}

/** Refreshes shipments that haven't been checked in the last 10 minutes. Returns true if anything was refreshed. */
export async function refreshStale(orders: OrdersRecordType[]): Promise<boolean> {
  if (!process.env.TRACK17_API_KEY) return false;
  const cutoff = Date.now() - 10 * 60 * 1000;
  const numbers = orders
    .filter((o) => o.trackingNumber && ACTIVE_SHIPPING.includes(o.status ?? '') &&
      (!o.lastTrackingCheck || new Date(o.lastTrackingCheck).getTime() < cutoff))
    .map((o) => o.trackingNumber!);
  if (!numbers.length) return false;
  try { await refreshTracking(numbers.slice(0, 40)); return true; }
  catch (e) { console.error('Tracking refresh failed', e); return false; }
}
