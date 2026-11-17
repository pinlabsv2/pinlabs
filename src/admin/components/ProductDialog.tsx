import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { manageCategories, manageShippingOptions, type ManageProductsInputType } from '@/lib/api';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Label } from '@/ui-kit/ui/label';
import { Textarea } from '@/ui-kit/ui/textarea';
import { Switch } from '@/ui-kit/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/ui-kit/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-kit/ui/select';
import PreorderFields from './PreorderFields';
import { ImagePicker, PdfPicker } from './MediaPickers';

export type Draft = NonNullable<ManageProductsInputType['product']>;
type Variant = Draft['variants'][0];
const NONE = '__none__';
export const emptyProduct: Draft = {
  name: '', description: '', price: 0, salePrice: null, size: '', purity: '≥99%', category: '', imageUrl: '', stock: null,
  active: false, featured: false, coaUrl: '', showCoa: false, hasVariants: false, shippingScope: 'product',
  shippingOptionId: null, subcategoryDividerId: null, variants: [],
};

const newVariant = (sortOrder: number): Variant => ({
  name: '', price: 0, salePrice: null, stock: null, shippingOptionId: null, active: true, sortOrder,
});

export default function ProductDialog({ initial, library, onSave, onClose }: {
  initial: Draft | null; library: string[]; onSave: (product: Draft) => Promise<void>; onClose: () => void;
}) {
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => manageCategories({ action: 'list' }) });
  const { data: shipping } = useQuery({ queryKey: ['shipping-options'], queryFn: () => manageShippingOptions({ action: 'list' }) });
  const [product, setProduct] = useState<Draft>(initial ?? emptyProduct);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setProduct((current) => ({ ...current, [key]: value }));
  const selectedCategory = categories?.categories.find((category) => category.name === product.category);
  const categoryNames = [...new Set([...(categories?.categories.map((category) => category.name) ?? []), ...(product.category ? [product.category] : [])])];

  const updateVariant = (index: number, patch: Partial<Variant>) => setProduct((current) => ({
    ...current,
    variants: current.variants.map((variant, variantIndex) => variantIndex === index ? { ...variant, ...patch } : variant),
  }));
  const moveVariant = (index: number, direction: -1 | 1) => setProduct((current) => {
    const destination = index + direction;
    if (destination < 0 || destination >= current.variants.length) return current;
    const variants = [...current.variants];
    [variants[index], variants[destination]] = [variants[destination], variants[index]];
    return { ...current, variants: variants.map((variant, sortOrder) => ({ ...variant, sortOrder })) };
  });
  const removeVariant = (index: number) => setProduct((current) => ({
    ...current,
    variants: current.variants.filter((_, variantIndex) => variantIndex !== index).map((variant, sortOrder) => ({ ...variant, sortOrder })),
  }));

  const save = async () => {
    if (!product.name.trim()) return setError('Name is required');
    if (product.showCoa && !product.coaUrl.trim()) return setError('Add a COA PDF or turn the COA off');
    if (product.salePrice != null && (!(product.salePrice > 0) || product.salePrice >= product.price)) return setError('Sale price must be lower than the regular price');
    if (product.hasVariants) {
      if (!product.variants.length) return setError('Add at least one variant');
      const invalid = product.variants.find((variant) => !variant.name.trim() || variant.salePrice != null && (!(variant.salePrice > 0) || variant.salePrice >= variant.price));
      if (invalid) return setError('Every variant needs a name and a valid sale price');
    }
    if (product.active && product.shippingScope === 'product' && !product.shippingOptionId) return setError('Choose a shipping option before making this product visible');
    if (product.active && product.shippingScope === 'variant' && product.variants.some((variant) => variant.active && !variant.shippingOptionId)) return setError('Every active variant needs a shipping option');
    setError('');
    setBusy(true);
    try { await onSave({ ...product, variants: product.variants.map((variant, sortOrder) => ({ ...variant, sortOrder })) }); }
    finally { setBusy(false); }
  };

  const shippingSelect = (value: string | null, onChange: (value: string | null) => void) => <Select value={value ?? NONE} onValueChange={(next) => onChange(next === NONE ? null : next)}><SelectTrigger><SelectValue placeholder="Choose shipping" /></SelectTrigger><SelectContent><SelectItem value={NONE}>Not assigned</SelectItem>{shipping?.options.map((option) => <SelectItem key={option.id} value={option.id}>{option.name} · ${option.price.toFixed(2)}</SelectItem>)}</SelectContent></Select>;

  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto"><DialogHeader><DialogTitle>{product.id ? 'Edit product' : 'New product'}</DialogTitle></DialogHeader>
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2"><Label>Name</Label><Input className="mt-1.5" value={product.name} onChange={(event) => set('name', event.target.value)} /></div>
      <div><Label>Category</Label><Select value={product.category || undefined} onValueChange={(category) => setProduct((current) => ({ ...current, category, subcategoryDividerId: null }))}><SelectTrigger className="mt-1.5"><SelectValue placeholder="Choose category" /></SelectTrigger><SelectContent>{categoryNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Visual divider</Label><Select value={product.subcategoryDividerId ?? NONE} disabled={!selectedCategory} onValueChange={(value) => set('subcategoryDividerId', value === NONE ? null : value)}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>No divider</SelectItem>{selectedCategory?.dividers.map((divider) => <SelectItem key={divider.id} value={divider.id}>{divider.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Purity</Label><Input className="mt-1.5" value={product.purity} onChange={(event) => set('purity', event.target.value)} /></div>
      <div className="flex items-end gap-5 pb-2"><label className="flex items-center gap-2 text-sm"><Switch checked={product.active} onCheckedChange={(active) => set('active', active)} />Visible in shop</label><label className="flex items-center gap-2 text-sm"><Switch checked={product.featured} onCheckedChange={(featured) => set('featured', featured)} />Featured</label></div>

      <div className="col-span-2 border p-4 space-y-4">
        <label className="flex items-center gap-3"><Switch checked={product.hasVariants} onCheckedChange={(hasVariants) => setProduct((current) => ({ ...current, hasVariants, shippingScope: hasVariants ? current.shippingScope : 'product', variants: hasVariants ? (current.variants.length ? current.variants : [newVariant(0)]) : [] }))} /><span><span className="block font-medium">This product has variants</span><span className="block text-xs text-muted-foreground">Each variant has its own name/size, price, stock, and optional origin.</span></span></label>
        {product.hasVariants && <div><Label>Shipping assignment</Label><Select value={product.shippingScope} onValueChange={(shippingScope: 'product' | 'variant') => setProduct((current) => ({ ...current, shippingScope, shippingOptionId: shippingScope === 'variant' ? null : current.shippingOptionId, variants: current.variants.map((variant) => ({ ...variant, shippingOptionId: shippingScope === 'product' ? null : variant.shippingOptionId })) }))}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="product">One option for the whole product</SelectItem><SelectItem value="variant">One option per variant</SelectItem></SelectContent></Select></div>}
        {product.shippingScope === 'product' && <div><Label>Shipping option</Label><div className="mt-1.5">{shippingSelect(product.shippingOptionId, (shippingOptionId) => set('shippingOptionId', shippingOptionId))}</div></div>}
      </div>

      {!product.hasVariants ? <>
        <div><Label>Price (USD)</Label><Input className="mt-1.5" type="number" min="0" step="0.01" value={product.price} onChange={(event) => set('price', Number(event.target.value))} /></div>
        <div><Label>Sale price</Label><Input className="mt-1.5" type="number" min="0" step="0.01" value={product.salePrice ?? ''} placeholder="Not on sale" onChange={(event) => set('salePrice', event.target.value === '' ? null : Number(event.target.value))} /></div>
        <div><Label>Name / size</Label><Input className="mt-1.5" value={product.size} onChange={(event) => set('size', event.target.value)} /></div>
        <div><Label>Stock</Label><Input className="mt-1.5" type="number" min="0" value={product.stock ?? ''} placeholder="Unlimited" onChange={(event) => set('stock', event.target.value === '' ? null : Number(event.target.value))} /></div>
      </> : <div className="col-span-2 space-y-3">
        <div className="flex items-center justify-between"><div><h3 className="font-medium">Variants</h3><p className="text-xs text-muted-foreground">Variant IDs stay stable when rows are edited or reordered.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setProduct((current) => ({ ...current, variants: [...current.variants, newVariant(current.variants.length)] }))}><Plus className="size-4" />Add variant</Button></div>
        {product.variants.map((variant, index) => <div key={variant.id ?? `new-${index}`} className="border p-4 space-y-3"><div className="flex items-center gap-2"><span className="font-mono text-xs text-muted-foreground">#{index + 1}</span><label className="ml-auto flex items-center gap-2 text-xs"><Switch checked={variant.active} onCheckedChange={(active) => updateVariant(index, { active })} />Active</label><Button type="button" size="icon" variant="ghost" disabled={index === 0} onClick={() => moveVariant(index, -1)}><ArrowUp className="size-4" /></Button><Button type="button" size="icon" variant="ghost" disabled={index === product.variants.length - 1} onClick={() => moveVariant(index, 1)}><ArrowDown className="size-4" /></Button><Button type="button" size="icon" variant="ghost" onClick={() => removeVariant(index)}><Trash2 className="size-4" /></Button></div><PreorderFields value={variant} inherited={!!product.preorderEnabled} onChange={(patch) => updateVariant(index, patch)} /><div className="grid sm:grid-cols-4 gap-3"><div className="sm:col-span-2"><Label>Name / size</Label><Input className="mt-1" value={variant.name} onChange={(event) => updateVariant(index, { name: event.target.value })} /></div><div><Label>Price</Label><Input className="mt-1" type="number" min="0" step="0.01" value={variant.price} onChange={(event) => updateVariant(index, { price: Number(event.target.value) })} /></div><div><Label>Sale price</Label><Input className="mt-1" type="number" min="0" step="0.01" value={variant.salePrice ?? ''} onChange={(event) => updateVariant(index, { salePrice: event.target.value === '' ? null : Number(event.target.value) })} /></div><div><Label>Stock</Label><Input className="mt-1" type="number" min="0" value={variant.stock ?? ''} placeholder="Unlimited" onChange={(event) => updateVariant(index, { stock: event.target.value === '' ? null : Number(event.target.value) })} /></div>{product.shippingScope === 'variant' && <div className="sm:col-span-3"><Label>Shipping option</Label><div className="mt-1">{shippingSelect(variant.shippingOptionId, (shippingOptionId) => updateVariant(index, { shippingOptionId }))}</div></div>}</div></div>)}
      </div>}

      <div className="col-span-2"><PreorderFields value={product} onChange={(patch) => setProduct((current) => ({ ...current, ...patch }))} /></div>
      <div className="col-span-2"><Label>Image</Label><div className="mt-1.5"><ImagePicker value={product.imageUrl} onChange={(imageUrl) => set('imageUrl', imageUrl)} library={library} /></div></div>
      <div className="col-span-2"><Label>Description</Label><Textarea className="mt-1.5" rows={4} value={product.description} onChange={(event) => set('description', event.target.value)} /></div>
      <div className="col-span-2 border p-3 space-y-2"><label className="flex items-center gap-2 text-sm font-medium"><Switch checked={product.showCoa} onCheckedChange={(showCoa) => set('showCoa', showCoa)} />Show certificate of analysis</label>{product.showCoa && <PdfPicker value={product.coaUrl} onChange={(coaUrl) => set('coaUrl', coaUrl)} />}</div>
    </div>
    {error && <p className="text-sm text-destructive">{error}</p>}
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={save}>Save product</Button></DialogFooter>
  </DialogContent></Dialog>;
}
