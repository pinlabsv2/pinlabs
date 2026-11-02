import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, FileCheck2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/ui-kit/ui/button';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import { ProductImage, Price } from '../components/ProductCard';
import { useCart } from '../lib/cart';
import { useStorefront } from '../lib/store';

export default function ProductPage() {
  const { id } = useParams();
  const { data, isLoading } = useStorefront();
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const p = data?.products.find((x) => x.id === id);

  if (isLoading) return <div className="container mx-auto px-4 py-10"><Skeleton className="h-96 rounded-xl" /></div>;
  if (!p) return <div className="container mx-auto px-4 py-20 text-center">Product not found. <Link to="/" className="text-primary underline">Back to shop</Link></div>;
  const out = p.stock !== null && p.stock <= 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="size-4" />All products</Link>
      <div className="grid md:grid-cols-2 gap-10">
        <ProductImage p={p} className="aspect-square w-full rounded-2xl border" />
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-primary">{p.category}</p>
          <h1 className="text-3xl font-bold tracking-tight mt-2">{p.name}</h1>
          <Price p={p} className="text-2xl mt-3" />
          <dl className="grid grid-cols-3 gap-3 my-6 text-sm">
            {[['Size', p.size], ['Purity', p.purity], ['Stock', p.stock === null ? 'In stock' : out ? 'Sold out' : `${p.stock} left`]].map(([k, v]) => (
              <div key={k} className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium font-mono">{v || '—'}</dd></div>
            ))}
          </dl>
          <p className="text-muted-foreground whitespace-pre-line">{p.description}</p>
          {p.coaUrl && (
            <a href={p.coaUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:border-primary hover:text-primary transition">
              <FileCheck2 className="size-4" />View certificate of analysis (COA)
            </a>
          )}
          <div className="flex gap-3 mt-8">
            <div className="flex items-center border rounded-md">
              <Button variant="ghost" size="icon" onClick={() => setQty(Math.max(1, qty - 1))}><Minus className="size-4" /></Button>
              <span className="w-8 text-center font-mono">{qty}</span>
              <Button variant="ghost" size="icon" disabled={p.stock !== null && qty >= p.stock} onClick={() => setQty(p.stock === null ? qty + 1 : Math.min(p.stock, qty + 1))}><Plus className="size-4" /></Button>
            </div>
            <Button className="flex-1" size="lg" disabled={out}
              onClick={() => { add({ productId: p.id, name: p.name, price: p.salePrice ?? p.price, size: p.size, imageUrl: p.imageUrl, stock: p.stock }, qty); toast.success('Added to cart'); }}>
              {out ? 'Sold out' : 'Add to cart'}
            </Button>
          </div>
          <p className="mt-6 text-xs text-muted-foreground border-l-2 border-promo pl-3">For laboratory research use only. Not for human or veterinary use.</p>
        </div>
      </div>
    </div>
  );
}
