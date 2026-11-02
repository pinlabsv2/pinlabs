import { useState } from 'react';
import { Copy, Ghost } from 'lucide-react';
import { toast } from 'sonner';
import { useStorefront } from '../lib/store';

export default function PromoBanner() {
  const { data } = useStorefront();
  const [hidden, setHidden] = useState(false);
  const p = data?.promo;
  if (!p?.active || hidden) return null;
  return (
    <div className="bg-promo text-promo-foreground text-sm">
      <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-3 flex-wrap text-center">
        <Ghost className="size-4 shrink-0" />
        <span className="font-semibold">{p.title}</span>
        {p.subtitle && <span className="opacity-90 hidden md:inline">{p.subtitle}</span>}
        {p.code && (
          <button
            onClick={() => { navigator.clipboard.writeText(p.code); toast.success(`Code ${p.code} copied`); }}
            className="inline-flex items-center gap-1.5 rounded-md bg-black/20 px-2 py-0.5 font-mono font-semibold hover:bg-black/30 transition"
          >
            {p.code}<Copy className="size-3" />
          </button>
        )}
        <button onClick={() => setHidden(true)} className="ml-2 opacity-70 hover:opacity-100" aria-label="Dismiss">✕</button>
      </div>
    </div>
  );
}
