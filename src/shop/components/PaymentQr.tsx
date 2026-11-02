import { useState } from 'react';
import { cn } from '@/ui-kit/lib/utils';

const SCHEME: Record<string, string> = {
  BTC: 'bitcoin', LTC: 'litecoin', ETH: 'ethereum', SOL: 'solana', TRX: 'tron',
};

export default function PaymentQr({ currency, address, amount }: { currency: string; address: string; amount: number }) {
  const scheme = SCHEME[currency];
  const [mode, setMode] = useState<'amount' | 'address'>(scheme ? 'amount' : 'address');
  const data = mode === 'amount' && scheme
    ? `${scheme}:${address}?${currency === 'ETH' ? 'value' : 'amount'}=${currency === 'ETH' ? BigInt(Math.round(amount * 1e6)) * 10n ** 12n : amount}`
    : address;
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=12&data=${encodeURIComponent(data)}`;

  return (
    <div className="flex flex-col items-center gap-3">
      {scheme && (
        <div className="inline-flex rounded-lg border bg-background p-1 text-sm">
          {(['amount', 'address'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={cn('px-3 py-1.5 rounded-md transition', mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {m === 'amount' ? 'With amount' : 'Address only'}
            </button>
          ))}
        </div>
      )}
      <img src={src} alt={`${currency} payment QR code`} className="size-52 rounded-xl border bg-white p-1" />
      <p className="text-xs text-muted-foreground text-center max-w-xs">
        {mode === 'amount' && scheme ? 'Scan with your wallet — address and amount are filled in for you.' : 'Scan to fill in the address, then enter the exact amount below.'}
      </p>
    </div>
  );
}
