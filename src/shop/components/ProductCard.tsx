import { Link } from 'react-router-dom';
import { Plus, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/ui-kit/ui/button';
import type { GetStorefrontOutputType } from '@/lib/api';
import { useCart } from '../lib/cart';
import { usd } from '../lib/store';

export type Product = GetStorefrontOutputType['products'][0];

export function Price({ p, className = '' }: { p: Product; className?: string }) {
  if (p.salePrice == null) return <span className={`font-mono font-semibold ${className}`}>{usd(p.price)}</span>;
  const pct = Math.round((1 - p.salePrice / p.price) * 100);
  return (
    <span className={`inline-flex items-baseline gap-1.5 flex-wrap ${className}`}>
      <span className="font-mono font-semibold text-promo">{usd(p.salePrice)}</span>
      <span className="font-mono text-[0.8em] text-muted-foreground line-through">{usd(p.price)}</span>
      <span className="rounded bg-promo text-promo-foreground text-[0.7em] font-mono font-semibold px-1.5 py-0.5 self-center">-{pct}%</span>
    </span>
  );
}

export function ProductImage({ p, className = '' }: { p: Product; className?: string }) {
  return p.imageUrl ? (
    <img src={p.imageUrl} alt={p.name} className={`object-cover ${className}`} />
  ) : (
    <div className={`grid place-items-center bg-muted ${className}`}>
      <FlaskConical className="size-10 text-primary/50" />
    </div>
  );
}

export default function ProductCard({ p }: { p: Product }) {
  const { add } = useCart();
  const out = p.stock !== null && p.stock <= 0;
  return (
    <div className="group rounded-xl border bg-card overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
      <Link to={`/product/${p.id}`} className="block relative">
        <ProductImage p={p} className="aspect-[4/3] w-full group-hover:scale-[1.02] transition-transform" />
        {p.salePrice != null && <span className="absolute top-3 right-3 rounded-none bg-promo text-promo-foreground text-xs px-2 py-0.5 font-mono font-semibold">SALE</span>}
        {p.featured && <span className="absolute top-3 left-3 rounded-none bg-promo text-promo-foreground text-xs px-2 py-0.5 font-medium">Featured</span>}
      </Link>
      <div className="p-4 flex flex-col gap-1 flex-1">
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span>{p.size}</span>{p.purity && <><span>·</span><span>{p.purity} purity</span></>}
        </div>
        <Link to={`/product/${p.id}`} className="font-semibold leading-tight hover:text-primary">{p.name}</Link>
        <div className="mt-auto pt-3 flex items-center justify-between">
          <Price p={p} />
          <Button size="sm" variant={out ? 'outline' : 'default'} disabled={out}
            onClick={() => { add({ productId: p.id, name: p.name, price: p.salePrice ?? p.price, size: p.size, imageUrl: p.imageUrl, stock: p.stock }); toast.success(`${p.name} added to cart`); }}>
            {out ? 'Sold out' : <><Plus className="size-4" />Add</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
