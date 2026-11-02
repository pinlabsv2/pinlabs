import { z } from 'zod';
import { createEndpoint } from '../../core/endpoint.js';
import { db } from '../../core/db.js';
import { orderSchema, toOrder } from '../lib/server/orderShape.js';
import { refreshStale } from '../lib/server/tracking.js';
import { checkOrderPayment } from '../lib/server/crypto.js';

export default createEndpoint({
  description: 'Lists orders for the admin table, checking pending crypto payments and refreshing shipments that are due',
  inputSchema: z.object({}),
  outputSchema: z.object({ orders: z.array(orderSchema) }),
  execute: async () => {
    const load = () => db.orders.findAll({ sort: [{ field: 'placedAt', direction: 'desc' }], limit: 2000 });
    let { records } = await load();
    const pending = records.filter((o) => o.status === 'Awaiting Payment' && o.payCurrency !== 'TEST').slice(0, 10);
    const results = await Promise.allSettled(pending.map((o) => checkOrderPayment(o.id)));
    const paymentsChanged = results.some((r, i) => r.status === 'fulfilled' && r.value !== pending[i].status);
    const trackingChanged = await refreshStale(records);
    if (paymentsChanged || trackingChanged) ({ records } = await load());
    return { orders: records.map(toOrder) };
  },
});
