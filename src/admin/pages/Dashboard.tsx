import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DollarSign, Clock, PackageCheck, Truck, AlertTriangle, ShoppingCart } from 'lucide-react';
import { getDashboard } from '@/lib/api';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import StatusBadge, { usd } from '../components/StatusBadge';

const MEDALS = ['🥇', '🥈', '🥉'];

function Kpi({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-4" />{label}</div>
      <p className="text-2xl font-semibold font-mono mt-2">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { data: d, isLoading, isError, refetch } = useQuery({ queryKey: ['dashboard'], queryFn: () => getDashboard({}) });
  if (isError) return <p className="text-sm text-destructive">Could not load the dashboard. <button type="button" className="underline" onClick={() => refetch()}>Try again</button></p>;
  if (isLoading || !d) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  const totalOrders = d.byStatus.reduce((a, s) => a + s.count, 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={DollarSign} label="Total revenue" value={usd(d.totalRevenue)} sub={`${usd(d.revenue30d)} last 30 days`} />
        <Kpi icon={ShoppingCart} label="Paid orders" value={String(d.paidOrders)} sub={`Avg ${usd(d.avgOrder)}`} />
        <Kpi icon={Clock} label="Awaiting payment" value={String(d.awaitingPayment)} />
        <Kpi icon={PackageCheck} label="Ready to ship" value={String(d.toShip)} />
        <Kpi icon={Truck} label="In transit" value={String(d.inTransit)} />
        <Kpi icon={AlertTriangle} label="Shipping exceptions" value={String(d.exceptions)} />
        {d.byCurrency.map((c) => <Kpi key={c.currency} icon={DollarSign} label={`Paid in ${c.currency}`} value={usd(c.revenue)} />)}
      </div>
      <div className="rounded-xl border bg-card p-4">
        <h3 className="font-semibold text-sm mb-4">Revenue — last 30 days</h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={d.revenueByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <Tooltip formatter={(v: number) => usd(v)} />
            <Area dataKey="revenue" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1) / 0.15)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="font-semibold text-sm mb-4">Orders by status</h3>
          {d.byStatus.length === 0 ? <p className="text-sm text-muted-foreground">No orders yet.</p> : (
            <ul className="divide-y">{d.byStatus.map((s) => (
              <li key={s.status} className="flex items-center justify-between py-2 text-sm">
                <StatusBadge status={s.status} />
                <span className="font-mono">{s.count} <span className="text-muted-foreground text-xs">({Math.round((s.count / totalOrders) * 100)}%)</span></span>
              </li>
            ))}</ul>
          )}
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h3 className="font-semibold text-sm mb-4">Top products</h3>
          {d.topProducts.length === 0 ? <p className="text-sm text-muted-foreground">No paid orders yet.</p> : (
            <div className="space-y-3">{d.topProducts.map((p, i) => (
              <div key={p.name} className="flex justify-between text-sm gap-2">
                <span><span className="inline-block w-6">{MEDALS[i] ?? <span className="text-muted-foreground font-mono text-xs">#{i + 1}</span>}</span>{p.name} <span className="text-muted-foreground">· {p.units} units</span></span>
                <span className="font-mono">{usd(p.revenue)}</span></div>
            ))}</div>
          )}
        </div>
      </div>
    </div>
  );
}
