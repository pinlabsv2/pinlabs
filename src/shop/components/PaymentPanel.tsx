import { useEffect, useState } from 'react';
import { AlertTriangle, Copy, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import type { GetMyOrderOutputType } from '@/lib/api';

import PaymentQr from './PaymentQr';

type Order = GetMyOrderOutputType['order'];

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <button onClick={() => { navigator.clipboard.writeText(value); toast.success(`${label} copied`); }}
        className="w-full flex items-center gap-2 rounded-lg border bg-background px-3 py-2.5 font-mono text-sm text-left hover:border-primary transition break-all">
        <span className="flex-1">{value}</span><Copy className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </div>
  );
}

export default function PaymentPanel({ order }: { order: Order }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = order.paymentExpiresAt ? new Date(order.paymentExpiresAt).getTime() - now : 0;
  const mm = Math.max(0, Math.floor(left / 60000));
  const ss = Math.max(0, Math.floor((left % 60000) / 1000));

  if (left <= 0) {
    return (
      <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-6">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-5" />
          <h2 className="font-semibold text-lg">Payment window expired</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Do not send payment using this quote. Its exchange rate is no longer valid.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-promo/40 bg-promo/5 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="size-5 text-promo" />
        <h2 className="font-semibold text-lg">Send your payment</h2>
        <span className="ml-auto font-mono text-sm">{left > 0 ? `${mm}:${String(ss).padStart(2, '0')} left` : 'Rate window passed'}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Send <b>exactly</b> the amount below in a single transaction. The exact amount is how we match your payment, so don't round it or subtract fees.
      </p>
      <PaymentQr currency={order.payCurrency} address={order.payAddress} amount={Number(order.cryptoAmount)} />
      <CopyRow label={`Amount (${order.payCurrency})`} value={String(order.cryptoAmount)} />
      <CopyRow label={`${order.payCurrency} address${order.payCurrency.includes('ERC20') || order.payCurrency === 'USDC' ? ' (Ethereum network)' : order.payCurrency.includes('TRC20') ? ' (Tron network)' : ''}`} value={order.payAddress} />
      <div className="flex items-start gap-2 rounded-lg bg-background/60 border px-3 py-2.5 text-sm text-muted-foreground">
        <Loader2 className="size-4 mt-0.5 shrink-0 animate-spin text-promo" />
        <p>Once sent, it usually takes anywhere from a couple of seconds to a couple of minutes for the blockchain to confirm your transaction. This page updates automatically when it's confirmed.</p>
      </div>
    </div>
  );
}
