import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { manageCategories, type ManageProductsOutputType } from '@/lib/api';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Label } from '@/ui-kit/ui/label';
import { Textarea } from '@/ui-kit/ui/textarea';
import { Switch } from '@/ui-kit/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/ui-kit/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-kit/ui/select';
import { ImagePicker, PdfPicker } from './MediaPickers';

export type Product = ManageProductsOutputType['products'][0];
export type Draft = Omit<Product, 'id'> & { id?: string };
export const emptyProduct: Draft = {
  name: '', description: '', price: 0, salePrice: null, size: '', purity: '≥99%', category: '', imageUrl: '', stock: null,
  active: true, featured: false, coaUrl: '', showCoa: false,
};

export default function ProductDialog({ initial, library, onSave, onClose }: {
  initial: Draft | null; library: string[]; onSave: (p: Draft) => Promise<void>; onClose: () => void;
}) {
  const { data: cats } = useQuery({ queryKey: ['categories'], queryFn: () => manageCategories({ action: 'list' }) });
  const [p, setP] = useState(initial ?? emptyProduct);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [onSale, setOnSale] = useState(p.salePrice != null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setP((x) => ({ ...x, [k]: v }));
  const names = [...new Set([...(cats?.categories.map((c) => c.name) ?? []), ...(p.category ? [p.category] : [])])];
  const pct = onSale && p.salePrice && p.price ? Math.round((1 - p.salePrice / p.price) * 100) : 0;

  const save = async () => {
    if (!p.name.trim()) return setErr('Name is required');
    if (!(p.price >= 0)) return setErr('Price must be a positive number');
    if (onSale && !(p.salePrice && p.salePrice > 0 && p.salePrice < p.price)) return setErr('Sale price must be lower than the regular price');
    if (p.showCoa && !p.coaUrl.trim()) return setErr('Add a COA PDF or turn the COA off');
    setBusy(true); try { await onSave({ ...p, salePrice: onSale ? p.salePrice : null }); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{p.id ? 'Edit product' : 'New product'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Name</Label><Input value={p.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div><Label>Price (USD)</Label><Input type="number" step="0.01" value={p.price} onChange={(e) => set('price', Number(e.target.value))} /></div>
          <div><Label>Stock (blank = unlimited)</Label><Input type="number" value={p.stock ?? ''} onChange={(e) => set('stock', e.target.value === '' ? null : Number(e.target.value))} /></div>
          <div className="col-span-2 rounded-lg border border-dashed p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium"><Switch checked={onSale} onCheckedChange={setOnSale} />On sale
              {pct > 0 && <span className="ml-auto rounded bg-promo/15 text-promo px-1.5 py-0.5 text-xs font-mono">−{pct}%</span>}</label>
            {onSale && <Input type="number" step="0.01" placeholder="Sale price (USD)" value={p.salePrice ?? ''} onChange={(e) => set('salePrice', e.target.value === '' ? null : Number(e.target.value))} />}
          </div>
          <div><Label>Size</Label><Input value={p.size} onChange={(e) => set('size', e.target.value)} /></div>
          <div><Label>Purity</Label><Input value={p.purity} onChange={(e) => set('purity', e.target.value)} /></div>
          <div className="col-span-2"><Label>Category</Label>
            <Select value={p.category || undefined} onValueChange={(v) => set('category', v)}><SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
              <SelectContent>{names.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <div className="col-span-2"><Label>Image</Label><div className="mt-1.5"><ImagePicker value={p.imageUrl} onChange={(v) => set('imageUrl', v)} library={library} /></div></div>
          <div className="col-span-2"><Label>Description</Label><Textarea rows={3} value={p.description} onChange={(e) => set('description', e.target.value)} /></div>
          <div className="col-span-2 rounded-lg border p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium"><Switch checked={p.showCoa} onCheckedChange={(v) => set('showCoa', v)} />Show COA (certificate of analysis)</label>
            {p.showCoa && <PdfPicker value={p.coaUrl} onChange={(v) => set('coaUrl', v)} />}
          </div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={p.active} onCheckedChange={(v) => set('active', v)} />Visible in shop</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={p.featured} onCheckedChange={(v) => set('featured', v)} />Featured</label>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
