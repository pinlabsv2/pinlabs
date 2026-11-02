import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Loader2, RefreshCw, MapPin, Truck, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateInvoice, refreshTracking, updateOrder, type ListOrdersOutputType } from '@/lib/api';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Label } from '@/ui-kit/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/ui-kit/ui/sheet';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/ui-kit/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/ui-kit/ui/alert-dialog';
import StatusBadge, { usd } from './StatusBadge';

type Order = ListOrdersOutputType['orders'][0];
const SHIPPABLE = ['Paid', 'Processing'];
const REFUNDABLE = ['Paid', 'Processing', 'Shipped', 'In Transit', 'Out for Delivery', 'Delivered', 'Exception'];

function ShipDialog({ open, onClose, onShip }: { open: boolean; onClose: () => void; onShip: (n: string) => Promise<void> }) {
  const [n, setN] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    if (n.trim().length < 5) return setErr('Enter a valid tracking number');
    setBusy(true); try { await onShip(n.trim()); setN(''); setErr(''); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Mark as shipped</DialogTitle>
          <DialogDescription>Enter the tracking number. The carrier is detected automatically and status updates sync from 17TRACK.</DialogDescription></DialogHeader>
        <div><Label>Tracking number</Label><Input autoFocus className="mt-1.5 font-mono" value={n} onChange={(e) => setN(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          {err && <p className="text-sm text-destructive mt-1">{err}</p>}</div>
        <DialogFooter><Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}{busy ? 'Syncing…' : 'Mark shipped'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function OrderSheet({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [shipOpen, setShipOpen] = useState(false);
  if (!order) return null;

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); await qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); }
    catch (e: any) { toast.error(e?.userFacingMessage ?? e?.message ?? 'Something went wrong'); }
    finally { setBusy(null); }
  };

  return (
    <Sheet open={!!order} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle className="font-mono flex items-center gap-3">{order.orderNumber}<StatusBadge status={order.status} /></SheetTitle></SheetHeader>
        <div className="space-y-6 mt-6 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-xs text-muted-foreground">Customer</p><p className="font-medium">{order.customerName}</p><p className="text-muted-foreground break-all">{order.customerEmail}</p></div>
            <div><p className="text-xs text-muted-foreground">Ship to</p><p className="whitespace-pre-line">{order.shippingAddress}</p></div>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            {order.items.map((i) => <div key={i.productId} className="flex justify-between"><span>{i.quantity}× {i.name}</span><span className="font-mono">{usd(i.price * i.quantity)}</span></div>)}
            {order.discount > 0 && <div className="flex justify-between text-promo"><span>{order.discountCode}</span><span className="font-mono">−{usd(order.discount)}</span></div>}
            <div className="flex justify-between font-semibold border-t pt-1"><span>Total</span><span className="font-mono">{usd(order.total)}</span></div>
            <p className="text-xs text-muted-foreground pt-1 break-all">{order.cryptoAmount} {order.payCurrency}{order.transactionHash && ` · tx ${order.transactionHash}`}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={!!busy || !SHIPPABLE.includes(order.status)} onClick={() => setShipOpen(true)}><Truck className="size-4" />Mark shipped</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive" disabled={!!busy || !REFUNDABLE.includes(order.status)}>
                  {busy === 'refund' ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}Refund</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Refund {order.orderNumber}?</AlertDialogTitle>
                  <AlertDialogDescription>This marks the order as refunded. Send the {order.cryptoAmount} {order.payCurrency} back to the customer from your wallet separately.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => run('refund', () => updateOrder({ id: order.id, action: 'refund' }), 'Order refunded')}>Refund order</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" disabled={!!busy || !order.trackingNumber} onClick={() => run('track', () => refreshTracking({ orderId: order.id }), 'Tracking refreshed')}>
              {busy === 'track' ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Refresh tracking
            </Button>
            <Button variant="outline" disabled={!!busy} onClick={() => run('pdf', async () => { const w = window.open('', '_blank'); const { html } = await generateInvoice({ id: order.id }); if (!w) throw new Error('Allow pop-ups to view the invoice'); w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }, 'Invoice ready')}>
              {busy === 'pdf' ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}Invoice PDF
            </Button>
          </div>
          {order.trackingNumber && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Tracking <b className="font-mono text-foreground">{order.trackingNumber}</b></span>
                {order.carrier && <span>Carrier <b className="text-foreground">{order.carrier}</b></span>}
                {order.lastTrackingCheck && <span>Checked {new Date(order.lastTrackingCheck).toLocaleString()}</span>}
              </div>
              {order.trackingEvents.length === 0 ? <p className="text-xs text-muted-foreground">No carrier scans yet — 17TRACK can take a few minutes to pick up a new number.</p> : (
                <ol className="border-l ml-1 space-y-3">
                  {order.trackingEvents.map((e, i) => (
                    <li key={i} className="pl-4 relative"><span className={`absolute -left-[4px] top-1.5 size-2 rounded-full ${i === 0 ? 'bg-primary' : 'bg-border'}`} />
                      <p className={i === 0 ? 'font-medium' : ''}>{e.description}</p><p className="text-xs text-muted-foreground flex items-center gap-1">{e.time && new Date(e.time).toLocaleString()}{e.location && <><MapPin className="size-3 ml-1" />{e.location}</>}</p></li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
        <ShipDialog open={shipOpen} onClose={() => setShipOpen(false)}
          onShip={async (n) => { await run('ship', () => updateOrder({ id: order.id, action: 'ship', trackingNumber: n }), 'Marked as shipped'); setShipOpen(false); }} />
      </SheetContent>
    </Sheet>
  );
}
