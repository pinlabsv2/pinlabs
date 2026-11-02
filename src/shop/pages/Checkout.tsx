import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAuth } from '@/lib/auth';
import { createOrder, validateDiscount, myAccount } from '@/lib/api';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Label } from '@/ui-kit/ui/label';
import AddressFields, { Address } from '../components/AddressFields';
import PaymentMethodPicker from '../components/PaymentMethodPicker';
import { useCart } from '../lib/cart';
import { usd, useStorefront } from '../lib/store';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your full name'),
  street: z.string().trim().min(3, 'Enter your street address'),
  city: z.string().trim().min(1, 'Enter your city'),
  postalCode: z.string().trim().min(2, 'Enter your postal code'),
  country: z.string().min(2, 'Select your country'),
});

export default function Checkout() {
  const { user } = useAuth();
  const { lines, subtotal, clear } = useCart();
  const { data } = useStorefront();
  const nav = useNavigate();
  const [name, setName] = useState(user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '');
  const [address, setAddress] = useState<Address>({ street: '', city: '', postalCode: '', country: '' });
  const [currency, setCurrency] = useState('');
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState<{ code: string; discount: number; label: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    myAccount({}).then((r) => {
      const n = `${r.profile.firstName} ${r.profile.lastName}`.trim();
      if (n) setName((x) => x || n);
      if (r.profile.address.street) setAddress((a) => (a.street ? a : r.profile.address));
    }).catch(() => {});
  }, []);
  useEffect(() => { if (!currency && data) setCurrency(data.paymentMethods[0]?.code ?? (data.testMode ? 'TEST' : '')); }, [data]);
  useEffect(() => { if (!code && data?.promo.active && data.promo.code) setCode(data.promo.code); }, [data]);

  if (lines.length === 0 && !busy) return <Navigate to="/cart" />;

  const discount = applied?.discount ?? 0;
  const after = subtotal - discount;
  const shipping = data?.freeShippingOver != null && after >= data.freeShippingOver ? 0 : data?.shippingFee ?? 0;
  const total = after + shipping;

  const apply = async () => {
    if (!code.trim()) return;
    try {
      const r = await validateDiscount({ code, subtotal });
      if (r.valid) { setApplied({ code, discount: r.discount, label: r.label }); toast.success(r.message); }
      else { setApplied(null); toast.error(r.message); }
    } catch (error: any) {
      setApplied(null);
      toast.error(error?.message ?? 'Could not validate that code');
    }
  };

  const submit = async () => {
    const unavailable = data && lines.find((line) => {
      const product = data.products.find((item) => item.id === line.productId);
      return !product || (product.stock !== null && product.stock < line.quantity);
    });
    if (unavailable) { toast.error(`${unavailable.name} is no longer available in that quantity`); return; }
    const parsed = schema.safeParse({ name, ...address });
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message]))); return; }
    if (!currency) { toast.error('Choose a payment method'); return; }
    setErrors({}); setBusy(true);
    try {
      const { id } = await createOrder({
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        customerName: name, address, payCurrency: currency as any, discountCode: applied?.code,
      });
      clear();
      nav(`/orders/${id}`);
    } catch (e: any) {
      toast.error(e?.userFacingMessage ?? e?.message ?? 'Could not place order');
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 grid lg:grid-cols-[1fr_360px] gap-8">
      <div className="space-y-8">
        <h1 className="text-2xl font-bold">Checkout</h1>
        <section className="space-y-4">
          <h2 className="font-semibold">Shipping</h2>
          <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}</div>
          <AddressFields value={address} onChange={setAddress} errors={errors} />
        </section>
        <section className="space-y-3">
          <h2 className="font-semibold">Payment method</h2>
          <PaymentMethodPicker methods={data?.paymentMethods ?? []} testMode={!!data?.testMode} value={currency} onChange={setCurrency} />
        </section>
      </div>
      <aside className="rounded-xl border bg-card p-5 h-fit space-y-3">
        {lines.map((l) => (
          <div key={l.productId} className="flex justify-between text-sm gap-3"><span className="truncate">{l.quantity}× {l.name}</span><span className="font-mono">{usd(l.price * l.quantity)}</span></div>
        ))}
        <div className="flex gap-2 pt-3 border-t">
          <Input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setApplied(null); }} placeholder="Discount code" className="font-mono" />
          <Button variant="outline" onClick={apply}><Tag className="size-4" /></Button>
        </div>
        <div className="space-y-1.5 text-sm border-t pt-3">
          <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{usd(subtotal)}</span></div>
          {applied && <div className="flex justify-between text-promo"><span>{applied.code} ({applied.label})</span><span className="font-mono">−{usd(discount)}</span></div>}
          <div className="flex justify-between"><span>Shipping</span><span className="font-mono">{shipping === 0 ? 'Free' : usd(shipping)}</span></div>
          <div className="flex justify-between font-semibold text-base pt-2"><span>Total</span><span className="font-mono">{usd(total)}</span></div>
        </div>
        <Button className="w-full" size="lg" onClick={submit} disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}{currency === 'TEST' ? 'Place test order' : `Place order${currency ? ` & pay in ${currency}` : ''}`}
        </Button>
        <p className="text-xs text-muted-foreground">By ordering you confirm products are for research use only.</p>
      </aside>
    </div>
  );
}
