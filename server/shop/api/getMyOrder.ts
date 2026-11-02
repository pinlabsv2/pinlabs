import { z } from 'zod';
import { createEndpoint, AppError } from '../../core/endpoint';
import { db } from '../../core/db';
import { orderSchema, toOrder } from '../lib/server/orderShape';
import { checkOrderPayment } from '../lib/server/crypto';
import { refreshStale } from '../lib/server/tracking';

export default createEndpoint({
  description: "Gets one of the signed-in customer's orders, checking payment and refreshing tracking when needed",
  authenticated: true,
  inputSchema: z.object({ id: z.string(), checkPayment: z.boolean().optional() }),
  outputSchema: z.object({ order: orderSchema }),
  execute: async ({ input, context }) => {
    const order = await db.orders.findOne({ id: input.id });
    const owner = Array.isArray(order?.customer) ? order?.customer[0] : order?.customer;
    if (!order || owner !== context.user.id) {
      throw new AppError({ code: 'NOT_FOUND', message: 'Order not found', userFacingMessage: 'Order not found.' });
    }
    let changed = false;
    if (input.checkPayment && order.status === 'Awaiting Payment') {
      try { await checkOrderPayment(order.id); changed = true; } catch (e) { console.error('Payment check failed', e); }
    }
    if (await refreshStale([order])) changed = true;
    const fresh = changed ? await db.orders.findOne({ id: order.id }) : order;
    return { order: toOrder(fresh!) };
  },
});
