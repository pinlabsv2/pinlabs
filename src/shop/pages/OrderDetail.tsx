import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { getMyOrder } from '@/lib/api';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import StatusBadge from '../components/StatusBadge';
import PaymentPanel from '../components/PaymentPanel';
import TrackingTimeline, { ProgressSteps } from '../components/TrackingTimeline';
import { usd } from '../lib/store';

export default function OrderDetail() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['order', id], queryFn: () => getMyOrder({ id }) });
  const order = data?.order;
  const awaiting = order?.status === 'Awaiting Payment';

  const check = async () => {
    const r = await getMyOrder({ id, checkPayment: true });
    qc.setQueryData(['order', id], r);
    if (r.order.status === 'Processing') toast.success('Payment received — thank you!');
  };

  useEffect(() => {
    if (!awaiting) return;
    const t = setInterval(() => check().catch(() => null), 30_000);
    return () => clearInterval(t);
  }, [awaiting, id]);

  if (isLoading) return <div className="container mx-auto px-4 py-10 max-w-3xl"><Skeleton className="h-96 rounded-xl" /></div>;
  if (error || !order) return <div className="container mx-auto px-4 py-20 text-center">Order not found. <Link to="/orders" className="text-primary underline">My orders</Link></div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <Link to="/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />My orders</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold font-mono">{order.orderNumber}</h1>
        <StatusBadge status={order.status} />
        {order.createdAt && <span className="text-sm text-muted-foreground ml-auto">Placed {new Date(order.createdAt).toLocaleString()}</span>}
      </div>

      {awaiting && <PaymentPanel order={order} />}
      {order.paidAt && (
        <div className="flex items-start gap-3 rounded-xl border bg-secondary/40 p-4 text-sm">
          <CheckCircle2 className="size-5 text-primary shrink-0" />
          <div className="min-w-0"><p className="font-medium">Paid {order.cryptoAmount} {order.payCurrency}</p>
            <p className="font-mono text-xs text-muted-foreground break-all">{order.transactionHash}</p></div>
        </div>
      )}

      {!['Awaiting Payment', 'Expired', 'Cancelled'].includes(order.status) && (
        <section className="rounded-xl border bg-card p-5 space-y-6">
          <ProgressSteps status={order.status === 'Exception' ? 'In Transit' : order.status} />
          <TrackingTimeline order={order} />
        </section>
      )}

      <section className="rounded-xl border bg-card p-5 grid md:grid-cols-2 gap-6">
        <div className="space-y-2 text-sm">
          <h2 className="font-semibold mb-2">Items</h2>
          {order.items.map((i) => <div key={i.productId} className="flex justify-between gap-3"><span>{i.quantity}× {i.name}</span><span className="font-mono">{usd(i.price * i.quantity)}</span></div>)}
          <div className="border-t pt-2 space-y-1">
            {order.discount > 0 && <div className="flex justify-between text-promo"><span>Discount {order.discountCode}</span><span className="font-mono">−{usd(order.discount)}</span></div>}
            <div className="flex justify-between"><span>Shipping</span><span className="font-mono">{order.shipping ? usd(order.shipping) : 'Free'}</span></div>
            <div className="flex justify-between font-semibold"><span>Total</span><span className="font-mono">{usd(order.total)}</span></div>
          </div>
        </div>
        <div className="text-sm">
          <h2 className="font-semibold mb-2">Ship to</h2>
          <p>{order.customerName}</p>
          <p className="whitespace-pre-line text-muted-foreground">{order.shippingAddress}</p>
        </div>
      </section>
    </div>
  );
}
