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
import { cartLineKey, useCart } from '../lib/cart';
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
  const navigate = useNavigate();
  const [name, setName] = useState(user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '');
  const [address, setAddress] = useState<Address>({ street: '', city: '', postalCode: '', country: '' });
  const [currency, setCurrency] = useState('');
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState<{ code: string; discount: number; label: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    myAccount({}).then((result) => {
      const fullName = `${result.profile.firstName} ${result.profile.lastName}`.trim();
      if (fullName) setName((current) => current || fullName);
      if (result.profile.address.street) setAddress((current) => current.street ? current : result.profile.address);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!currency && data) setCurrency(data.paymentMethods[0]?.code ?? (data.testMode ? 'TEST' : ''));
  }, [data, currency]);
  useEffect(() => {
    if (!code && data?.promo.active && data.promo.code) setCode(data.promo.code);
  }, [data, code]);
  useEffect(() => { setApplied(null); }, [subtotal]);

  if (lines.length === 0 && !busy) return <Navigate to="/cart" />;

  const shippingOptions = [...new Map(lines.flatMap((line) => line.shippingOption ? [[line.shippingOption.id, line.shippingOption] as const] : [])).values()];
  const shipping = Math.round(shippingOptions.reduce((sum, option) => sum + option.price, 0) * 100) / 100;
  const discount = Math.min(subtotal, applied?.discount ?? 0);
  const total = Math.round((subtotal - discount + shipping) * 100) / 100;
  const hasUnavailable = lines.some((line) => !line.available);

  const apply = async () => {
    if (!code.trim()) return;
    try {
      const result = await validateDiscount({ code, subtotal });
      if (result.valid) {
        setApplied({ code: code.trim().toUpperCase(), discount: result.discount, label: result.label });
        toast.success(result.message);
      } else {
        setApplied(null);
        toast.error(result.message);
      }
    } catch (error: any) {
      setApplied(null);
      toast.error(error?.message ?? 'Could not validate that code');
    }
  };

  const submit = async () => {
    if (!data) return;
    const unavailable = lines.find((line) => {
      if (!line.available || !line.shippingOption) return true;
      const product = data.products.find((item) => item.id === line.productId);
      if (!product) return true;
      const sku = line.variantId ? product.variants.find((item) => item.id === line.variantId) : product.hasVariants ? undefined : product;
      return !sku || !sku.purchasable || sku.shippingOption?.id !== line.shippingOption.id || typeof sku.stock === 'number' && sku.stock < line.quantity;
    });
    if (unavailable) {
      toast.error(`${unavailable.name} changed or is no longer available. Return to your cart to update it.`);
      return;
    }
    const parsed = schema.safeParse({ name, ...address });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])));
      return;
    }
    if (!currency) {
      toast.error('Choose a payment method');
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const { id } = await createOrder({
        items: lines.map((line) => ({ productId: line.productId, variantId: line.variantId, quantity: line.quantity })),
        customerName: name,
        address,
        payCurrency: currency as any,
        discountCode: applied?.code,
      });
      clear();
      navigate(`/orders/${id}`);
    } catch (error: any) {
      toast.error(error?.userFacingMessage ?? error?.message ?? 'Could not place order');
      setBusy(false);
    }
  };

  return <div className="container mx-auto px-4 py-10 grid lg:grid-cols-[1fr_360px] gap-8">
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Checkout</h1>
      <section className="space-y-4">
        <h2 className="font-semibold">Shipping</h2>
        <div><Label>Full name</Label><Input value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5" />{errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}</div>
        <AddressFields value={address} onChange={setAddress} errors={errors} />
      </section>
      <section className="space-y-3"><h2 className="font-semibold">Payment method</h2><PaymentMethodPicker methods={data?.paymentMethods ?? []} testMode={!!data?.testMode} value={currency} onChange={setCurrency} /></section>
    </div>
    <aside className="border bg-card p-5 h-fit space-y-3">
      {lines.map((line) => <div key={cartLineKey(line)} className="text-sm"><div className="flex justify-between gap-3"><span className="truncate">{line.quantity}× {line.name}</span><span className="font-mono">{usd(line.price * line.quantity)}</span></div>{line.shippingOption && <p className="text-xs text-muted-foreground">Ships from {line.shippingOption.name}</p>}{!line.available && <p className="text-xs text-destructive">{line.unavailableReason}</p>}</div>)}
      <div className="flex gap-2 pt-3 border-t"><Input value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); setApplied(null); }} placeholder="Discount code" className="font-mono" /><Button variant="outline" onClick={apply} aria-label="Apply discount code"><Tag className="size-4" /></Button></div>
      <div className="space-y-1.5 text-sm border-t pt-3">
        <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{usd(subtotal)}</span></div>
        {applied && <div className="flex justify-between text-promo"><span>{applied.code} ({applied.label})</span><span className="font-mono">−{usd(discount)}</span></div>}
        {shippingOptions.map((option) => <div key={option.id} className="flex justify-between gap-3"><span className="truncate">Shipping · {option.name}</span><span className="font-mono">{option.price === 0 ? 'Free' : usd(option.price)}</span></div>)}
        <div className="flex justify-between font-semibold text-base pt-2 border-t"><span>Total</span><span className="font-mono">{usd(total)}</span></div>
      </div>
      {hasUnavailable && <p className="text-xs text-destructive">Return to your cart and remove or reselect unavailable items.</p>}
      <Button className="w-full" size="lg" onClick={submit} disabled={busy || hasUnavailable || !data}>
        {busy && <Loader2 className="size-4 animate-spin" />}{currency === 'TEST' ? 'Place test order' : `Place order${currency ? ` & pay in ${currency}` : ''}`}
      </Button>
      <p className="text-xs text-muted-foreground">Each distinct shipping origin is charged once. By ordering you confirm products are for research use only.</p>
    </aside>
  </div>;
}
