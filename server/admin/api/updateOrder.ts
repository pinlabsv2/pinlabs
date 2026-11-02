import { z } from 'zod';
import { createEndpoint, AppError } from '../../core/endpoint';
import { db } from '../../core/db';
import { orderSchema, toOrder } from '../lib/server/orderShape';
import { registerTracking, refreshTracking } from '../lib/server/tracking';
import { notifyCustomer } from '../lib/server/notify';

const bad = (m: string) => new AppError({ code: 'BAD_REQUEST', message: m, userFacingMessage: m });

export default createEndpoint({
  description: 'Marks an order as shipped (with tracking number, synced from 17TRACK) or refunds it',
  inputSchema: z.object({
    id: z.string(),
    action: z.enum(['ship', 'refund']),
    trackingNumber: z.string().optional(),
  }),
  outputSchema: z.object({ order: orderSchema }),
  execute: async ({ input }) => {
    const order = await db.orders.findOne({ id: input.id });
    if (!order) throw bad('Order not found');

    if (input.action === 'refund') {
      if (order.status === 'Refunded') throw bad('Order is already refunded');
      if (['Awaiting Payment', 'Expired', 'Cancelled'].includes(order.status ?? '')) throw bad('Only paid orders can be refunded.');
      await db.orders.update({ id: order.id, record: { status: 'Refunded' } });
      await notifyCustomer(order, 'shipping_update', `Your order ${order.orderNumber} has been refunded.`);
    } else {
      if (!['Paid', 'Processing'].includes(order.status ?? '')) throw bad('Only paid orders awaiting shipment can be marked shipped.');
      const tracking = input.trackingNumber?.trim().replace(/\s+/g, '');
      if (!tracking) throw bad('Enter a tracking number');
      await db.orders.update({
        id: order.id,
        record: { status: 'Shipped', trackingNumber: tracking, carrier: null, trackingEventsJson: '[]', trackingStatus: null, lastTrackingCheck: null },
      });
      await notifyCustomer(order, 'shipping_update', `Your order has shipped. Tracking number: ${tracking}.`);
      try {
        if (await registerTracking(tracking)) {
          // 17TRACK usually needs a few seconds to fetch from the carrier after registering
          for (let i = 0; i < 3; i++) {
            await new Promise((r) => setTimeout(r, 4000));
            await refreshTracking([tracking]);
            const o = await db.orders.findOne({ id: order.id });
            if (o?.trackingEventsJson && o.trackingEventsJson !== '[]') break;
          }
        }
      } catch (e) {
        console.error('17TRACK sync failed', e);
      }
    }
    const fresh = await db.orders.findOne({ id: order.id });
    return { order: toOrder(fresh!) };
  },
});
