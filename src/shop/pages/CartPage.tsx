import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useAuth, loginWithRedirect } from '@/lib/auth';
import { Button } from '@/ui-kit/ui/button';
import { cartLineKey, useCart } from '../lib/cart';
import { usd } from '../lib/store';

export default function CartPage() {
  const { lines, setQty, remove, subtotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const unavailable = lines.some((line) => !line.available);
  const shippingOptions = [...new Map(lines.flatMap((line) => line.shippingOption ? [[line.shippingOption.id, line.shippingOption] as const] : [])).values()];
  const shipping = shippingOptions.reduce((sum, option) => sum + option.price, 0);

  if (lines.length === 0) return <div className="container mx-auto px-4 py-24 text-center">
    <ShoppingBag className="size-10 mx-auto text-muted-foreground" />
    <p className="mt-4 text-lg font-medium">Your cart is empty</p>
    <Button asChild className="mt-6"><Link to="/">Browse products</Link></Button>
  </div>;

  return <div className="container mx-auto px-4 py-10 grid lg:grid-cols-[1fr_340px] gap-8">
    <div>
      <h1 className="text-2xl font-bold mb-6">Cart</h1>
      <div className="divide-y border bg-card">
        {lines.map((line) => <div key={cartLineKey(line)} className="flex items-center gap-4 p-4">
          <div className="flex-1 min-w-0">
            <Link to={`/product/${line.productId}`} className="font-medium hover:text-primary">{line.name}</Link>
            <p className="text-xs font-mono text-muted-foreground">{line.size} · {usd(line.price)}</p>
            {line.shippingOption && <p className="text-xs text-muted-foreground">Ships from {line.shippingOption.name}</p>}
            {!line.available && <p className="mt-1 text-xs text-destructive">{line.unavailableReason}</p>}
          </div>
          <div className="flex items-center border">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setQty(line, line.quantity - 1)}><Minus className="size-3" /></Button>
            <span className="w-7 text-center font-mono text-sm">{line.quantity}</span>
            <Button variant="ghost" size="icon" className="size-8" disabled={!line.available || typeof line.stock === 'number' && line.quantity >= line.stock} onClick={() => setQty(line, line.quantity + 1)}><Plus className="size-3" /></Button>
          </div>
          <span className="w-20 text-right font-mono">{usd(line.price * line.quantity)}</span>
          <Button variant="ghost" size="icon" onClick={() => remove(line)} aria-label={`Remove ${line.name}`}><Trash2 className="size-4" /></Button>
        </div>)}
      </div>
    </div>
    <aside className="border bg-card p-5 h-fit lg:mt-14 space-y-3">
      <div className="flex justify-between text-sm"><span>Subtotal</span><span className="font-mono">{usd(subtotal)}</span></div>
      {shippingOptions.map((option) => <div key={option.id} className="flex justify-between gap-3 text-sm"><span className="truncate">Shipping · {option.name}</span><span className="font-mono">{option.price === 0 ? 'Free' : usd(option.price)}</span></div>)}
      <div className="flex justify-between border-t pt-3 font-medium"><span>Before discounts</span><span className="font-mono">{usd(subtotal + shipping)}</span></div>
      <p className="text-xs text-muted-foreground">Each distinct shipping origin is charged once. Discounts are calculated at checkout.</p>
      {unavailable && <p className="text-xs text-destructive">Remove unavailable items or reselect changed variants before checkout.</p>}
      <Button className="w-full" size="lg" disabled={unavailable} onClick={() => user ? navigate('/checkout') : loginWithRedirect({ redirectUrl: '/checkout' })}>
        {unavailable ? 'Cart has unavailable items' : user ? 'Checkout' : 'Sign in to checkout'}
      </Button>
    </aside>
  </div>;
}
