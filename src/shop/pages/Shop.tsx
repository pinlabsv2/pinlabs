import { useMemo, useState } from 'react';
import { Search, ShieldCheck, Truck, Microscope } from 'lucide-react';
import { Input } from '@/ui-kit/ui/input';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import { cn } from '@/ui-kit/lib/utils';
import ProductCard, { type Product } from '../components/ProductCard';
import { useStorefront } from '../lib/store';

type ProductGroup = { key: string; category: string; divider: string; products: Product[] };

export default function Shop() {
  const { data, isLoading } = useStorefront();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<'best' | 'name' | 'low' | 'high'>('best');

  const groups = useMemo<ProductGroup[]>(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let products = (data?.products ?? []).filter((product) =>
      (category === 'All' || product.category === category)
      && `${product.name} ${product.description}`.toLowerCase().includes(normalizedQuery));
    if (sort === 'name') products = [...products].sort((left, right) => left.name.localeCompare(right.name));
    if (sort === 'low') products = [...products].sort((left, right) => left.minPrice - right.minPrice);
    if (sort === 'high') products = [...products].sort((left, right) => right.maxPrice - left.maxPrice);

    const result: ProductGroup[] = [];
    const knownCategoryNames = new Set(data?.categories.map((item) => item.name) ?? []);
    const categories = category === 'All'
      ? (data?.categories ?? [])
      : (data?.categories.filter((item) => item.name === category) ?? []);
    for (const item of categories) {
      const categoryProducts = products.filter((product) => product.category === item.name);
      const dividerIds = new Set(item.dividers.map((divider) => divider.id));
      const ungrouped = categoryProducts.filter((product) => !product.subcategoryDividerId || !dividerIds.has(product.subcategoryDividerId));
      if (ungrouped.length) result.push({ key: `${item.id}:ungrouped`, category: item.name, divider: '', products: ungrouped });
      for (const divider of item.dividers) {
        const divided = categoryProducts.filter((product) => product.subcategoryDividerId === divider.id);
        if (divided.length) result.push({ key: `${item.id}:${divider.id}`, category: item.name, divider: divider.name, products: divided });
      }
    }
    if (category === 'All') {
      const uncategorized = products.filter((product) => !knownCategoryNames.has(product.category));
      if (uncategorized.length) result.push({ key: 'uncategorized', category: 'Other', divider: '', products: uncategorized });
    }
    return result;
  }, [data, query, category, sort]);

  return <div>
    <section className="border-b bg-background">
      <div className="container mx-auto px-4 py-14 md:py-20 grid md:grid-cols-[1.4fr_1fr] gap-10 items-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-foreground mb-4">HPLC-verified · Paid in crypto · Tracked to your door</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.05] text-foreground">Lab-verified peptides,<br />shipped discreetly.</h1>
          <p className="mt-4 text-muted-foreground max-w-lg">High-purity lyophilized peptides for in-vitro research. Pay with crypto, track every shipment in real time.</p>
          <p className="mt-2 text-sm font-mono text-muted-foreground">No middlemen. No card processors. No guesswork.</p>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-1 gap-3">
          {[[Microscope, '≥99% HPLC purity', 'Third-party tested'], [ShieldCheck, 'Crypto checkout', 'BTC, ETH, SOL, USDT & more'], [Truck, 'Tracked shipping', 'Live 17TRACK updates']].map(([Icon, title, subtitle]: any) => <div key={title} className="flex items-center gap-3 border bg-card p-3"><Icon className="size-5 text-foreground shrink-0" /><div className="min-w-0"><p className="text-sm font-medium truncate">{title}</p><p className="text-xs text-muted-foreground truncate hidden sm:block">{subtitle}</p></div></div>)}
        </div>
      </div>
    </section>

    <section className="container mx-auto px-4 py-10">
      <div className="flex flex-col md:flex-row gap-3 md:items-center mb-8">
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setCategory('All')} className={cn('px-3.5 py-1.5 text-sm border transition', category === 'All' ? 'bg-foreground text-background border-foreground' : 'hover:bg-muted')}>All</button>
          {data?.categories.map((item) => <button key={item.id} onClick={() => setCategory(item.name)} className={cn('px-3.5 py-1.5 text-sm border transition', category === item.name ? 'bg-foreground text-background border-foreground' : 'hover:bg-muted')}>{item.name}</button>)}
        </div>
        <div className="md:ml-auto flex gap-2">
          <div className="relative flex-1 md:w-64"><Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search compounds" className="pl-9" /></div>
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="border bg-background px-3 text-sm">
            <option value="best">Featured / best selling</option><option value="name">A–Z</option><option value="low">Price ↑</option><option value="high">Price ↓</option>
          </select>
        </div>
      </div>
      {isLoading ? <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-72" />)}</div>
        : groups.length === 0 ? <p className="text-center text-muted-foreground py-20">No products match your search.</p>
        : <div className="space-y-10">{groups.map((group, index) => {
          const showCategory = index === 0 || groups[index - 1].category !== group.category;
          return <section key={group.key} className="space-y-4">
            {showCategory && <h2 className="text-2xl font-semibold lowercase">{group.category}</h2>}
            {group.divider && <div className="flex items-center gap-3" aria-label={`${group.divider} section`}><span className="size-2.5 shrink-0 bg-foreground" /><h3 className="text-sm font-medium">{group.divider}</h3><span className="h-px flex-1 bg-border" /></div>}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">{group.products.map((product) => <ProductCard key={product.id} p={product} />)}</div>
          </section>;
        })}</div>}
    </section>
  </div>;
}
