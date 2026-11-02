import { useState } from 'react';
import { Bitcoin, ChevronDown, FlaskConical, Check } from 'lucide-react';
import { cn } from '@/ui-kit/lib/utils';

type Method = { code: string; network: string };

const ICON_BASE = 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/';
const LOGO: Record<string, string> = { BTC: 'btc', ETH: 'eth', SOL: 'sol', LTC: 'ltc', 'USDT-ERC20': 'usdt', 'USDT-TRC20': 'usdt', USDC: 'usdc', TRX: 'trx' };

export function CoinLogo({ code, className = 'size-5' }: { code: string; className?: string }) {
  const l = LOGO[code];
  if (!l) return <FlaskConical className={cn(className, 'text-primary')} />;
  return <img src={`${ICON_BASE}${l}.svg`} alt="" className={cn(className, 'shrink-0')} loading="lazy" />;
}

function Row({ m, selected, onSelect }: { m: Method; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected}
      className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
        selected ? 'border-primary bg-primary/10' : 'hover:border-muted-foreground')}>
      <CoinLogo code={m.code} />
      <span className="font-mono text-sm font-semibold">{m.code}</span>
      <span className="text-xs text-muted-foreground truncate">{m.network}</span>
      {selected && <Check className="size-3.5 text-primary ml-auto shrink-0" />}
    </button>
  );
}

function Category({ icon: Icon, title, hint, children }: { icon: any; title: string; hint: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg border">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-4 py-3 text-sm">
        <Icon className="size-4 text-primary" /><span className="font-medium">{title}</span>
        <span className="text-xs text-muted-foreground font-mono">{hint}</span>
        <ChevronDown className={cn('size-4 ml-auto transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function PaymentMethodPicker({ methods, testMode, value, onChange }: {
  methods: Method[]; testMode: boolean; value: string; onChange: (c: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Category icon={Bitcoin} title="Crypto" hint="auto-confirmed on-chain">
        {methods.length === 0
          ? <p className="col-span-full text-sm text-muted-foreground">No crypto wallets set up yet.</p>
          : methods.map((m) => <Row key={m.code} m={m} selected={value === m.code} onSelect={() => onChange(m.code)} />)}
      </Category>
      {testMode && (
        <Category icon={FlaskConical} title="Developer" hint="test mode on">
          <Row m={{ code: 'TEST', network: 'Skip payment' }} selected={value === 'TEST'} onSelect={() => onChange('TEST')} />
        </Category>
      )}
    </div>
  );
}
