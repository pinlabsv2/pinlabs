import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, FileCheck2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/ui-kit/ui/button';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import { ProductImage } from '../components/ProductCard';
import { useSeason } from '../components/seasonal/SeasonProvider';
import type { CSSProperties } from 'react';
import { useCart } from '../lib/cart';
import { usd, useStorefront } from '../lib/store';

export default function ProductPage() {
  const { id } = useParams();
  const { data, isLoading } = useStorefront();
  const { add } = useCart();
  const coloredBlack = useSeason().season === 'colored-black';
  const [qty, setQty] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const product = data?.products.find((item) => item.id === id);
  const variant = product?.variants.find((item) => item.id === selectedVariantId);
  const stock = product?.hasVariants ? variant?.stock : product?.stock;

  useEffect(() => {
    setSelectedVariantId('');
    setQty(1);
  }, [id]);
  useEffect(() => {
    setQty((current) => typeof stock === 'number' && stock > 0 ? Math.min(current, Math.floor(stock)) : 1);
  }, [selectedVariantId, stock]);

  if (isLoading) return <div className="container mx-auto px-4 py-10"><Skeleton className="h-96" /></div>;
  if (!product) return <div className="container mx-auto px-4 py-20 text-center">Product not found. <Link to="/" className="text-primary underline">Back to shop</Link></div>;

  const selected = product.hasVariants ? variant : null;
  const price = selected ? selected.price : product.price;
  const salePrice = selected ? selected.salePrice : product.salePrice;
  const shippingOption = selected ? selected.shippingOption : product.shippingOption;
  const available = product.hasVariants ? !!selected?.purchasable : product.purchasable;
  const unavailableReason = product.hasVariants && !selected
    ? 'Choose a variant to continue'
    : selected?.unavailableReason || product.unavailableReason;
  const preorder = selected ?? product;
  const displayPrice = salePrice ?? price;
  const soldOut = typeof stock === 'number' && stock <= 0;

  return <div className="container mx-auto px-4 py-8">
    <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="size-4" />All products</Link>
    <div className="grid md:grid-cols-2 gap-10">
      <ProductImage p={product} className="aspect-square w-full border" />
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-primary" style={coloredBlack ? {'--category-color': data?.categories.find((item)=>item.name===product.category)?.color ?? '#9E9C92'} as CSSProperties : undefined}>{coloredBlack && <span className="category-color-swatch" aria-hidden="true"/>}{product.category}</p>
        <h1 className="text-3xl font-bold tracking-tight mt-2">{product.name}</h1>
        {product.shippingOption && <p className="mt-1 text-sm text-muted-foreground">Ships from {product.shippingOption.name}</p>}

        {product.hasVariants && <fieldset className="mt-6 space-y-2">
          <legend className="text-sm font-medium mb-2">Choose a variant</legend>
          {product.variants.map((item) => {
            const itemPrice = item.salePrice ?? item.price;
            const itemSoldOut = item.stock !== null && item.stock <= 0;
            return <button
              key={item.id}
              type="button"
              aria-pressed={selectedVariantId === item.id}
              onClick={() => setSelectedVariantId(item.id)}
              className={`w-full border p-3 text-left transition ${selectedVariantId === item.id ? 'border-foreground bg-muted' : 'hover:border-foreground/50'}`}
            >
              <span className="flex items-start justify-between gap-3"><span className="font-medium">{item.name}</span><span className="font-mono">{usd(itemPrice)}</span></span>
              <span className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>{item.shippingOption ? `Ships from ${item.shippingOption.name}` : item.unavailableReason}</span>
                <span>{item.preorderEnabled ? `Preorder · dispatch ${item.preorderExpectedShipAt ? new Date(item.preorderExpectedShipAt).toLocaleDateString() : 'pending'}` : item.stock === null ? 'In stock' : itemSoldOut ? 'Sold out' : `${item.stock} left`}</span>
              </span>
            </button>;
          })}
        </fieldset>}

        {preorder.preorderEnabled && <p className="mt-4 border border-primary p-3 text-sm"><strong>Preorder · full payment now</strong><br />Expected dispatch: {preorder.preorderExpectedShipAt ? new Date(preorder.preorderExpectedShipAt).toLocaleDateString() : 'To be confirmed'}. This item is not ready to ship.</p>}
        <div className="mt-5">
          {salePrice == null ? <span className="font-mono text-2xl font-semibold">{product.hasVariants && !selected ? `${usd(product.minPrice)}–${usd(product.maxPrice)}` : usd(price)}</span> : <span className="inline-flex items-baseline gap-2"><span className="font-mono text-2xl font-semibold text-promo">{usd(salePrice)}</span><span className="font-mono text-muted-foreground line-through">{usd(price)}</span></span>}
        </div>
        <dl className="grid grid-cols-2 gap-3 my-6 text-sm">
          <div className="border p-3"><dt className="text-xs text-muted-foreground">Purity</dt><dd className="font-medium font-mono">{product.purity || '—'}</dd></div>
          <div className="border p-3"><dt className="text-xs text-muted-foreground">{preorder.preorderEnabled ? "Preorder allocation" : "Stock"}</dt><dd className="font-medium font-mono">{product.hasVariants && !selected ? 'Select variant' : stock === null ? 'In stock' : soldOut ? 'Sold out' : `${stock} left`}</dd></div>
        </dl>
        <p className="text-muted-foreground whitespace-pre-line">{product.description}</p>
        {product.coaUrl && <a href={product.coaUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 border px-3 py-2 text-sm hover:border-primary hover:text-primary transition"><FileCheck2 className="size-4" />View certificate of analysis (COA)</a>}
        <div className="flex gap-3 mt-8">
          <div className="flex items-center border">
            <Button variant="ghost" size="icon" onClick={() => setQty(Math.max(1, qty - 1))}><Minus className="size-4" /></Button>
            <span className="w-8 text-center font-mono">{qty}</span>
            <Button variant="ghost" size="icon" disabled={typeof stock === 'number' && qty >= stock} onClick={() => setQty(stock == null ? qty + 1 : Math.min(stock, qty + 1))}><Plus className="size-4" /></Button>
          </div>
          <Button
            className="flex-1"
            size="lg"
            disabled={!available || !shippingOption}
            onClick={() => {
              if (!shippingOption) return;
              add({
                preorderEnabled: preorder.preorderEnabled, preorderExpectedShipAt: preorder.preorderExpectedShipAt,
                productId: product.id,
                variantId: selected?.id ?? null,
                productName: product.name,
                variantName: selected?.name ?? '',
                name: selected ? `${product.name} — ${selected.name}` : product.name,
                price: displayPrice,
                size: selected?.name ?? product.size,
                imageUrl: product.imageUrl,
                stock: stock ?? null,
                shippingOption,
              }, qty);
              toast.success('Added to cart');
            }}
          >{available ? preorder.preorderEnabled ? 'Preorder' : 'Add to cart' : unavailableReason || 'Unavailable'}</Button>
        </div>
        {!available && unavailableReason && product.hasVariants && selected && <p className="mt-2 text-sm text-destructive">{unavailableReason}</p>}
        <p className="mt-6 text-xs text-muted-foreground border-l-2 border-promo pl-3">For laboratory research use only. Not for human or veterinary use.</p>
      </div>
    </div>
  </div>;
}
