import { z } from 'zod';
import { createEndpoint } from '../../core/endpoint.js';
import { db } from '../../core/db.js';
import { refreshTracking } from '../lib/server/tracking.js';

export default createEndpoint({
  description: 'Daily shipment check: pulls latest 17TRACK status for all active shipments and updates orders that moved',
  inputSchema: z.object({ orderId: z.string().optional() }),
  outputSchema: z.object({ checked: z.number(), moved: z.number() }),
  execute: async ({ input }) => {
    let numbers: string[];
    if (input.orderId) {
      const o = await db.orders.findOne({ id: input.orderId });
      numbers = o?.trackingNumber ? [o.trackingNumber] : [];
    } else {
      const { records } = await db.orders.findAll({
        filters: { status: { in: ['Shipped', 'In Transit', 'Out for Delivery', 'Exception'] }, trackingNumber: { not: null } },
        limit: 2000,
      });
      numbers = records.map((r) => r.trackingNumber!).filter(Boolean);
    }
    if (numbers.length === 0 || !process.env.TRACK17_API_KEY) return { checked: 0, moved: 0 };
    const moved = await refreshTracking(numbers);
    return { checked: numbers.length, moved };
  },
});
