import { z } from 'zod';
import { createEndpoint } from '../../core/endpoint';
import { db } from '../../core/db';
import { orderSchema, toOrder } from '../lib/server/orderShape';
import { refreshStale } from '../lib/server/tracking';

export default createEndpoint({
  description: "Lists the signed-in customer's orders",
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({ orders: z.array(orderSchema) }),
  execute: async ({ context }) => {
    const load = () => db.orders.findAll({
      filters: { customer: context.user.id },
      sort: [{ field: 'placedAt', direction: 'desc' }],
      limit: 200,
    });
    let { records } = await load();
    if (await refreshStale(records)) ({ records } = await load());
    return { orders: records.map(toOrder) };
  },
});
