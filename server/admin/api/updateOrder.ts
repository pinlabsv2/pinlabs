import { z } from 'zod';
import { createEndpoint, AppError } from '../../core/endpoint.js';
import { db } from '../../core/db.js';
import { enqueueOrderStatusEmail } from '../../core/email/orderEmails.js';
import { orderSchema, toOrder } from '../lib/server/orderShape.js';
import { registerTracking, refreshTracking } from '../lib/server/tracking.js';

const bad = (message: string) => new AppError({ code: 'BAD_REQUEST', message, userFacingMessage: message });

export default createEndpoint({
  description: 'Marks an order as shipped (with tracking number, synced from 17TRACK) or refunds it',
  inputSchema: z.object({
    id: z.string(),
    action: z.enum(['ship', 'refund']),
    trackingNumber: z.string().optional(),
  }),
  outputSchema: z.object({ order: orderSchema }),
  execute: async ({ input }) => {
    const tracking = input.action === 'ship' ? input.trackingNumber?.trim().replace(/\s+/g, '') : undefined;
    if (input.action === 'ship' && !tracking) throw bad('Enter a tracking number');

    await db.transaction(async (tx) => {
      const { rows } = await tx.query(`SELECT * FROM "Orders" WHERE "id" = $1 FOR UPDATE`, [input.id]);
      const order = rows[0];
      if (!order) throw bad('Order not found');
      if (input.action === 'refund') {
        if (order.status === 'Refunded') throw bad('Order is already refunded');
        if (['Awaiting Payment', 'Expired', 'Cancelled'].includes(String(order.status ?? ''))) throw bad('Only paid orders can be refunded.');
        const updated = await tx.query(`UPDATE "Orders" SET "status" = 'Refunded', "updatedAt" = now() WHERE "id" = $1 RETURNING *`, [order.id]);
        await enqueueOrderStatusEmail(tx, updated.rows[0], 'order_refunded', 'refunded');
        return;
      }
      if (!['Paid', 'Processing'].includes(String(order.status ?? ''))) throw bad('Only paid orders awaiting shipment can be marked shipped.');
      const updated = await tx.query(
        `UPDATE "Orders" SET "status" = 'Shipped', "trackingNumber" = $2, "carrier" = NULL,
          "trackingEventsJson" = '[]', "trackingStatus" = NULL, "lastTrackingCheck" = NULL, "updatedAt" = now()
         WHERE "id" = $1 RETURNING *`,
        [order.id, tracking],
      );
      await enqueueOrderStatusEmail(tx, updated.rows[0], 'order_shipped', String(tracking));
    });

    if (input.action === 'ship' && tracking) {
      try {
        if (await registerTracking(tracking)) {
          for (let index = 0; index < 3; index++) {
            await new Promise((resolve) => setTimeout(resolve, 4_000));
            await refreshTracking([tracking]);
            const order = await db.orders.findOne({ id: input.id });
            if (order?.trackingEventsJson && order.trackingEventsJson !== '[]') break;
          }
        }
      } catch (error) {
        console.error('17TRACK sync failed', error);
      }
    }
    const fresh = await db.orders.findOne({ id: input.id });
    return { order: toOrder(fresh!) };
  },
});
