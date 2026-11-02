import { z } from 'zod';
import { createEndpoint } from '../../core/endpoint';
import { db } from '../../core/db';

const PAID = `"status" NOT IN ('Awaiting Payment','Expired','Cancelled','Refunded')`;

export default createEndpoint({
  description: 'Dashboard stats: orders, revenue and shipping status',
  inputSchema: z.object({}),
  outputSchema: z.object({
    totalRevenue: z.number(), paidOrders: z.number(), awaitingPayment: z.number(), avgOrder: z.number(),
    toShip: z.number(), inTransit: z.number(), exceptions: z.number(), revenue30d: z.number(),
    revenueByDay: z.array(z.object({ date: z.string(), revenue: z.number(), orders: z.number() })),
    byStatus: z.array(z.object({ status: z.string(), count: z.number() })),
    byCurrency: z.array(z.object({ currency: z.string(), revenue: z.number() })),
    topProducts: z.array(z.object({ name: z.string(), units: z.number(), revenue: z.number() })),
  }),
  execute: async () => {
    const [totals, byDay, byStatus, byCur, top] = await Promise.all([
      db.sql({ query: `SELECT
        COALESCE(SUM("total") FILTER (WHERE ${PAID}),0) AS "rev",
        COUNT(*) FILTER (WHERE ${PAID}) AS "paid",
        COUNT(*) FILTER (WHERE "status"='Awaiting Payment') AS "awaiting",
        COUNT(*) FILTER (WHERE "status" IN ('Paid','Processing')) AS "toShip",
        COUNT(*) FILTER (WHERE "status" IN ('Shipped','In Transit','Out for Delivery')) AS "transit",
        COUNT(*) FILTER (WHERE "status"='Exception') AS "exc",
        COALESCE(SUM("total") FILTER (WHERE ${PAID} AND "placedAt" >= now() - interval '30 days'),0) AS "rev30"
        FROM "Orders"` }),
      db.sql({ query: `SELECT to_char(d, 'YYYY-MM-DD') AS "date",
        COALESCE(SUM(o."total"),0) AS "revenue", COUNT(o.id) AS "orders"
        FROM generate_series(current_date - 29, current_date, interval '1 day') d
        LEFT JOIN "Orders" o ON o."placedAt"::date = d::date AND o.${PAID}
        GROUP BY d ORDER BY d` }),
      db.sql({ query: `SELECT "status", COUNT(*) AS "count" FROM "Orders" WHERE "status" IS NOT NULL GROUP BY "status" ORDER BY 2 DESC` }),
      db.sql({ query: `SELECT "payCurrency" AS "currency", COALESCE(SUM("total"),0) AS "revenue" FROM "Orders" WHERE ${PAID} AND "payCurrency" IS NOT NULL GROUP BY "payCurrency"` }),
      db.sql({ query: `SELECT i->>'name' AS "name", SUM((i->>'quantity')::numeric) AS "units",
        SUM((i->>'quantity')::numeric * (i->>'price')::numeric) AS "revenue"
        FROM "Orders" o, jsonb_array_elements(CASE WHEN o."itemsJson" LIKE '[%' THEN o."itemsJson"::jsonb ELSE '[]'::jsonb END) i
        WHERE o.${PAID} GROUP BY 1 ORDER BY 3 DESC LIMIT 5` }),
    ]);
    const t = totals.rows[0] ?? {};
    const paid = Number(t.paid ?? 0);
    const rev = Number(t.rev ?? 0);
    return {
      totalRevenue: rev, paidOrders: paid, awaitingPayment: Number(t.awaiting ?? 0),
      avgOrder: paid ? rev / paid : 0, toShip: Number(t.toShip ?? 0), inTransit: Number(t.transit ?? 0),
      exceptions: Number(t.exc ?? 0), revenue30d: Number(t.rev30 ?? 0),
      revenueByDay: byDay.rows.map((r) => ({ date: String(r.date), revenue: Number(r.revenue), orders: Number(r.orders) })),
      byStatus: byStatus.rows.map((r) => ({ status: String(r.status), count: Number(r.count) })),
      byCurrency: byCur.rows.map((r) => ({ currency: String(r.currency), revenue: Number(r.revenue) })),
      topProducts: top.rows.map((r) => ({ name: String(r.name), units: Number(r.units), revenue: Number(r.revenue) })),
    };
  },
});
