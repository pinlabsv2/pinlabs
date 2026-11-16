import { db } from './db.js';
import type { OrdersRecordType } from './types.js';
import { enqueueOrderStatusEmail, enqueuePaymentReceivedEmails } from './email/orderEmails.js';
import type { QueryRunner } from './pg.js';

async function lockOrderState(tx: QueryRunner) {
  // The seeded settings row provides the same transaction lock in Postgres and PGlite.
  await tx.query(`SELECT "id" FROM "StoreSettings" ORDER BY "createdAt" LIMIT 1 FOR UPDATE`);
}

export async function claimOrderPayment(orderId: string, hash: string): Promise<OrdersRecordType | undefined> {
  const claimed = await db.transaction(async (tx) => {
    await lockOrderState(tx);
    const duplicate = await tx.query(
      `SELECT "id" FROM "Orders" WHERE "transactionHash" = $1 AND "id" <> $2 LIMIT 1`,
      [hash, orderId],
    );
    if (duplicate.rows[0]) return undefined;
    const { rows } = await tx.query(
      `UPDATE "Orders"
         SET "status" = 'Processing', "transactionHash" = $2, "paidAt" = now(), "updatedAt" = now()
       WHERE "id" = $1 AND "status" = 'Awaiting Payment'
       RETURNING *`,
      [orderId, hash],
    );
    const order = rows[0] as OrdersRecordType | undefined;
    if (order) await enqueuePaymentReceivedEmails(tx, order);
    return order;
  });
  return claimed ? db.orders.findOne({ id: orderId }) : undefined;
}

export async function releaseOrderReservation(orderId: string, status: 'Expired' | 'Cancelled'): Promise<boolean> {
  return db.transaction(async (tx) => {
    await lockOrderState(tx);
    const { rows } = await tx.query(`SELECT * FROM "Orders" WHERE "id" = $1 FOR UPDATE`, [orderId]);
    const order = rows[0];
    if (!order || order.status !== 'Awaiting Payment') return false;

    const changed = await tx.query(
      `UPDATE "Orders" SET "status" = $2, "updatedAt" = now()
       WHERE "id" = $1 AND "status" = 'Awaiting Payment' RETURNING "id"`,
      [orderId, status],
    );
    if (!changed.rows[0]) return false;

    const parsedItems = typeof order.itemsJson === 'string' ? JSON.parse(order.itemsJson || '[]') : order.itemsJson;
    const items = Array.isArray(parsedItems) ? parsedItems as Array<{ productId?: string; variantId?: string | null; quantity?: number }> : [];
    const reservations = new Map<string, { table: 'Products' | 'ProductVariants'; id: string; quantity: number }>();
    for (const item of items) {
      const id = item.variantId || item.productId;
      const quantity = Number(item.quantity ?? 0);
      if (!id || !Number.isInteger(quantity) || quantity <= 0) continue;
      const table = item.variantId ? 'ProductVariants' : 'Products';
      const key = `${table}:${id}`;
      const existing = reservations.get(key);
      reservations.set(key, { table, id, quantity: (existing?.quantity ?? 0) + quantity });
    }
    for (const reservation of [...reservations.values()].sort((a, b) => `${a.table}:${a.id}`.localeCompare(`${b.table}:${b.id}`))) {
      await tx.query(
        `UPDATE "${reservation.table}" SET "stock" = "stock" + $2, "updatedAt" = now()
         WHERE "id" = $1 AND "stock" IS NOT NULL`,
        [reservation.id, reservation.quantity],
      );
    }

    let discountId = order.discountCodeId as string | undefined;
    if (!discountId && order.discountCode) {
      const found = await tx.query(
        `SELECT "id" FROM "DiscountCodes" WHERE upper("code") = upper($1) ORDER BY "createdAt" LIMIT 1 FOR UPDATE`,
        [order.discountCode],
      );
      discountId = found.rows[0]?.id;
    }
    if (discountId) {
      await tx.query(
        `UPDATE "DiscountCodes"
         SET "timesUsed" = GREATEST(0, COALESCE("timesUsed", 0) - 1), "updatedAt" = now()
         WHERE "id" = $1`,
        [discountId],
      );
    }
    await enqueueOrderStatusEmail(tx, { ...order, status }, status === 'Expired' ? 'order_expired' : 'order_cancelled', status.toLowerCase());
    return true;
  });
}
