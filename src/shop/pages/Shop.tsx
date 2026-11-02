import { useMemo, useState } from 'react';
import { Search, ShieldCheck, Truck, Microscope } from 'lucide-react';
import { Input } from '@/ui-kit/ui/input';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import { cn } from '@/ui-kit/lib/utils';
import ProductCard from '../components/ProductCard';
import { useStorefront } from '../lib/store';


export default function Shop() {
  const { data, isLoading } = useStorefront();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [sort, setSort] = useState<'best' | 'name' | 'low' | 'high'>('best');

  const CATS = ['All', ...(data?.categories ?? [])];
  const products = useMemo(() => {
    let list = (data?.products ?? []).filter((p) =>
      (cat === 'All' || p.category === cat) && `${p.name} ${p.description}`.toLowerCase().includes(q.toLowerCase()));
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'low') list = [...list].sort((a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price));
    if (sort === 'high') list = [...list].sort((a, b) => (b.salePrice ?? b.price) - (a.salePrice ?? a.price));
    return list;
  }, [data, q, cat, sort]);

  return (
    <div>
      <section className="border-b bg-background">
        <div className="container mx-auto px-4 py-14 md:py-20 grid md:grid-cols-[1.4fr_1fr] gap-10 items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-foreground mb-4">HPLC-verified · Paid in crypto · Tracked to your door</p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.05] text-foreground">Lab-verified peptides,<br />shipped discreetly.</h1>
            <p className="mt-4 text-muted-foreground max-w-lg">High-purity lyophilized peptides for in-vitro research. Pay with crypto, track every shipment in real time.</p>
            <p className="mt-2 text-sm font-mono text-muted-foreground">No middlemen. No card processors. No guesswork.</p>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-1 gap-3">
            {[[Microscope, '≥99% HPLC purity', 'Third-party tested'], [ShieldCheck, 'Crypto checkout', 'BTC, ETH, SOL, USDT & more'], [Truck, 'Tracked shipping', 'Live 17TRACK updates']].map(([Icon, t, s]: any) => (
              <div key={t} className="flex items-center gap-3 rounded-none border bg-card p-3">
                <Icon className="size-5 text-foreground shrink-0" />
                <div className="min-w-0"><p className="text-sm font-medium truncate">{t}</p><p className="text-xs text-muted-foreground truncate hidden sm:block">{s}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row gap-3 md:items-center mb-6">
          <div className="flex gap-1.5 flex-wrap">
            {CATS.map((c) => (
              <button key={c} onClick={() => setCat(c)}
                className={cn('rounded-none px-3.5 py-1.5 text-sm border transition', cat === c ? 'bg-foreground text-background border-foreground' : 'hover:bg-muted')}>{c}</button>
            ))}
          </div>
          <div className="md:ml-auto flex gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search compounds" className="pl-9" />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="rounded-md border bg-background px-3 text-sm">
              <option value="best">Featured / best selling</option><option value="name">A–Z</option><option value="low">Price ↑</option><option value="high">Price ↓</option>
            </select>
          </div>
        </div>
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}</div>
        ) : products.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">No products match your search.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        )}
      </section>
    </div>
  );
}
