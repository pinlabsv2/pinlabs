import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Package } from 'lucide-react';
import { getMyOrders } from '@/lib/api';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import { Button } from '@/ui-kit/ui/button';
import StatusBadge from '../components/StatusBadge';
import { usd } from '../lib/store';

export default function Orders() {
  const { data, isLoading } = useQuery({ queryKey: ['myOrders'], queryFn: () => getMyOrders({}) });
  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">My orders</h1>
      {isLoading ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        : !data?.orders.length ? (
          <div className="text-center py-20 border rounded-xl bg-card">
            <Package className="size-10 mx-auto text-muted-foreground" />
            <p className="mt-3">No orders yet.</p>
            <Button asChild className="mt-5"><Link to="/">Start shopping</Link></Button>
          </div>
        ) : (
          <div className="space-y-3">
            {data.orders.map((o) => (
              <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center gap-4 rounded-xl border bg-card p-4 hover:shadow-md transition">
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-semibold">{o.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.createdAt && new Date(o.createdAt).toLocaleDateString()} · {o.items.reduce((a, i) => a + i.quantity, 0)} items
                    {o.trackingNumber && <> · {o.trackingNumber}</>}
                  </p>
                </div>
                <StatusBadge status={o.status} />
                <span className="font-mono w-20 text-right hidden sm:block">{usd(o.total)}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
    </div>
  );
}
