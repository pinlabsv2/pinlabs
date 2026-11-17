import { Link } from 'react-router-dom';
import { ArrowRight, Plus, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/ui-kit/ui/button';
import type { GetStorefrontOutputType } from '@/lib/api';
import { useCart } from '../lib/cart';
import { SeasonalCardDecoration } from './seasonal/SeasonalExperience';
import { usd } from '../lib/store';

export type Product = GetStorefrontOutputType['products'][0];

export function Price({ p, className = '' }: { p: Product; className?: string }) {
  if (p.hasVariants) {
    const range = p.minPrice === p.maxPrice ? usd(p.minPrice) : `${usd(p.minPrice)}–${usd(p.maxPrice)}`;
    return <span className={`font-mono font-semibold ${className}`}>{range}</span>;
  }
  if (p.salePrice == null) return <span className={`font-mono font-semibold ${className}`}>{usd(p.price)}</span>;
  const pct = Math.round((1 - p.salePrice / p.price) * 100);
  return <span className={`inline-flex items-baseline gap-1.5 flex-wrap ${className}`}>
    <span className="font-mono font-semibold text-promo">{usd(p.salePrice)}</span>
    <span className="font-mono text-[0.8em] text-muted-foreground line-through">{usd(p.price)}</span>
    <span className="bg-promo text-promo-foreground text-[0.7em] font-mono font-semibold px-1.5 py-0.5 self-center">-{pct}%</span>
  </span>;
}

export function ProductImage({ p, className = '' }: { p: Product; className?: string }) {
  return p.imageUrl
    ? <img src={p.imageUrl} alt={p.name} className={`object-cover ${className}`} />
    : <div className={`grid place-items-center bg-muted ${className}`}><FlaskConical className="size-10 text-primary/50" /></div>;
}

export default function ProductCard({ p }: { p: Product }) {
  const { add } = useCart();
  const unavailable = !p.purchasable;
  return <article className="season-product-card group border bg-card overflow-hidden flex flex-col">
    <Link to={`/product/${p.id}`} className="season-product-image block relative">
      <SeasonalCardDecoration/>
      <ProductImage p={p} className="aspect-[4/3] w-full group-hover:scale-[1.02] transition-transform" />
      {!p.hasVariants && p.salePrice != null && <span className="absolute top-3 right-3 bg-promo text-promo-foreground text-xs px-2 py-0.5 font-mono font-semibold">SALE</span>}
      {p.featured && <span className="absolute top-3 left-3 bg-promo text-promo-foreground text-xs px-2 py-0.5 font-medium">Featured</span>}
    </Link>
    <div className="p-4 flex flex-col gap-1 flex-1">
      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
        <span>{p.hasVariants ? `${p.variants.length} variants` : p.size}</span>{p.purity && <><span>·</span><span>{p.purity} purity</span></>}
      </div>
      <Link to={`/product/${p.id}`} className="font-semibold leading-tight hover:text-primary">{p.name}</Link>
      {p.shippingOption && <p className="text-xs text-muted-foreground">Ships from {p.shippingOption.name}</p>}
      {p.hasVariants && p.shippingScope === 'variant' && <p className="text-xs text-muted-foreground">Origin shown with each variant</p>}
      {(p.preorderEnabled || p.variants.some((v) => v.preorderEnabled)) && <p className="text-xs font-medium text-primary">{p.hasVariants ? 'Preorder options available' : `Preorder · dispatch ${p.preorderExpectedShipAt ? new Date(p.preorderExpectedShipAt).toLocaleDateString() : 'pending'}`}</p>}
      {unavailable && <p className="text-xs text-destructive">{p.unavailableReason}</p>}
      <div className="mt-auto pt-3 flex items-center justify-between gap-3">
        <Price p={p} />
        {p.hasVariants ? <Button asChild size="sm" variant="outline"><Link to={`/product/${p.id}`}>Choose <ArrowRight className="size-4" /></Link></Button> : <Button
          size="sm"
          variant={unavailable ? 'outline' : 'default'}
          disabled={unavailable}
          onClick={() => {
            if (!p.shippingOption) return;
            add({ preorderEnabled: p.preorderEnabled, preorderExpectedShipAt: p.preorderExpectedShipAt, productId: p.id, variantId: null, productName: p.name, variantName: '', name: p.name, price: p.salePrice ?? p.price, size: p.size, imageUrl: p.imageUrl, stock: p.stock, shippingOption: p.shippingOption });
            toast.success(`${p.name} added to cart`);
          }}
        >{unavailable ? 'Unavailable' : <><Plus className="size-4" />{p.preorderEnabled ? 'Preorder' : 'Add'}</>}</Button>}
      </div>
    </div>
  </article>;
}
