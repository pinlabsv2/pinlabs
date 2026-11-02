import { ArrowUpRight, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import { useStorefront } from '../lib/store';

const ICON: Record<string, string> = { Telegram: '✈️', WhatsApp: '💬', Discord: '🎮', Email: '✉️' };

function linkFor(channel: string, handle: string): string | null {
  const h = handle.trim();
  if (channel === 'Email') return `mailto:${h}`;
  if (channel === 'Telegram') return h.startsWith('http') ? h : `https://t.me/${h.replace(/^@/, '')}`;
  if (channel === 'WhatsApp') return h.startsWith('http') ? h : `https://wa.me/${h.replace(/\D/g, '')}`;
  if (channel === 'Discord') return h.startsWith('http') ? h : null;
  return null;
}

export default function Support() {
  const { data, isLoading } = useStorefront();
  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <p className="font-mono text-xs uppercase tracking-widest text-primary">Support</p>
      <h1 className="text-3xl font-bold tracking-tight mt-2">Talk to a human.</h1>
      <p className="text-muted-foreground mt-2">Questions about an order, payment or shipment? Reach us on any channel below — include your order number.</p>
      <div className="mt-8 space-y-3">
        {isLoading ? <Skeleton className="h-40 rounded-xl" />
          : !data?.support.length ? <p className="text-sm text-muted-foreground">No support channels listed yet.</p>
          : data.support.map((c, i) => {
            const href = linkFor(c.channel, c.handle);
            return (
              <div key={i} className="flex items-center gap-4 rounded-xl border bg-card p-4">
                <span className="text-2xl">{ICON[c.channel] ?? '💬'}</span>
                <div className="flex-1 min-w-0"><p className="font-medium">{c.label || c.channel}</p><p className="text-sm font-mono text-muted-foreground truncate">{c.channel} · {c.handle}</p></div>
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">Open<ArrowUpRight className="size-4" /></a>
                ) : (
                  <button onClick={() => { navigator.clipboard.writeText(c.handle); toast.success('Copied'); }} className="inline-flex items-center gap-1 text-sm text-primary"><Copy className="size-4" />Copy</button>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
