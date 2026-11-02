import { db } from './db.js';
import type { OrdersRecordType } from './types.js';
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
    if (duplicate.rows[0]) return false;
    const { rows } = await tx.query(
      `UPDATE "Orders"
         SET "status" = 'Processing', "transactionHash" = $2, "paidAt" = now(), "updatedAt" = now()
       WHERE "id" = $1 AND "status" = 'Awaiting Payment'
       RETURNING "id"`,
      [orderId, hash],
    );
    return !!rows[0];
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

    const items = JSON.parse(order.itemsJson ?? '[]') as { productId: string; quantity: number }[];
    for (const item of items) {
      await tx.query(
        `UPDATE "Products" SET "stock" = "stock" + $2, "updatedAt" = now()
         WHERE "id" = $1 AND "stock" IS NOT NULL`,
        [item.productId, item.quantity],
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
    return true;
  });
}
