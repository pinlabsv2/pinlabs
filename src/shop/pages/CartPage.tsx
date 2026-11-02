import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useAuth, loginWithRedirect } from '@/lib/auth';
import { Button } from '@/ui-kit/ui/button';
import { useCart } from '../lib/cart';
import { usd } from '../lib/store';

export default function CartPage() {
  const { lines, setQty, remove, subtotal } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const unavailable = lines.some((line) => line.stock === 0);

  if (lines.length === 0) return (
    <div className="container mx-auto px-4 py-24 text-center">
      <ShoppingBag className="size-10 mx-auto text-muted-foreground" />
      <p className="mt-4 text-lg font-medium">Your cart is empty</p>
      <Button asChild className="mt-6"><Link to="/">Browse products</Link></Button>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-10 grid lg:grid-cols-[1fr_340px] gap-8">
      <div>
        <h1 className="text-2xl font-bold mb-6">Cart</h1>
        <div className="divide-y border rounded-xl bg-card">
          {lines.map((l) => (
            <div key={l.productId} className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{l.name}</p>
                <p className="text-xs font-mono text-muted-foreground">{l.size} · {usd(l.price)}{l.stock === 0 && <span className="ml-2 text-destructive">Sold out</span>}</p>
              </div>
              <div className="flex items-center border rounded-md">
                <Button variant="ghost" size="icon" className="size-8" onClick={() => setQty(l.productId, l.quantity - 1)}><Minus className="size-3" /></Button>
                <span className="w-7 text-center font-mono text-sm">{l.quantity}</span>
                <Button variant="ghost" size="icon" className="size-8" disabled={typeof l.stock === 'number' && l.quantity >= l.stock} onClick={() => setQty(l.productId, l.quantity + 1)}><Plus className="size-3" /></Button>
              </div>
              <span className="w-20 text-right font-mono">{usd(l.price * l.quantity)}</span>
              <Button variant="ghost" size="icon" onClick={() => remove(l.productId)} aria-label="Remove"><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </div>
      </div>
      <aside className="rounded-xl border bg-card p-5 h-fit lg:mt-14">
        <div className="flex justify-between text-sm"><span>Subtotal</span><span className="font-mono">{usd(subtotal)}</span></div>
        <p className="text-xs text-muted-foreground mt-1">Shipping and discounts calculated at checkout.</p>
        {unavailable && <p className="text-xs text-destructive mt-3">Remove unavailable items before checkout.</p>}
        <Button className="w-full mt-5" size="lg" disabled={unavailable}
          onClick={() => (user ? nav('/checkout') : loginWithRedirect({ redirectUrl: '/checkout' }))}>
          {unavailable ? 'Cart has unavailable items' : user ? 'Checkout' : 'Sign in to checkout'}
        </Button>
      </aside>
    </div>
  );
}
