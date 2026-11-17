import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { manageCategories, manageProducts, manageShippingOptions } from '@/lib/api';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui-kit/ui/table';
import ProductDialog, { Draft, emptyProduct } from '../components/ProductDialog';
import ConfirmDelete from '../components/ConfirmDelete';
import { usd } from '../components/StatusBadge';

export default function Products() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['products'], queryFn: () => manageProducts({ action: 'list' }) });
  const { data: shipping } = useQuery({ queryKey: ['shipping-options'], queryFn: () => manageShippingOptions({ action: 'list' }) });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => manageCategories({ action: 'list' }) });
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Draft | null>(null);
  const rows = useMemo(() => (data?.products ?? []).filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase())), [data, query]);
  const optionName = (id: string | null) => shipping?.options.find((option) => option.id === id)?.name ?? 'Not assigned';
  const dividerName = (category: string, id: string | null) => categories?.categories.find((item) => item.name === category)?.dividers.find((divider) => divider.id === id)?.name;

  const save = async (product: Draft) => {
    try {
      const result = await manageProducts({ action: 'save', product });
      qc.setQueryData(['products'], result);
      await Promise.all([qc.invalidateQueries({ queryKey: ['categories'] }), qc.invalidateQueries({ queryKey: ['shipping-options'] }), qc.invalidateQueries({ queryKey: ['storefront'] })]);
      setEditing(null);
      toast.success('Product saved');
    } catch (error: any) { toast.error(error?.message ?? 'Save failed'); }
  };
  const remove = async (id: string) => {
    try {
      qc.setQueryData(['products'], await manageProducts({ action: 'delete', id }));
      await Promise.all([qc.invalidateQueries({ queryKey: ['categories'] }), qc.invalidateQueries({ queryKey: ['shipping-options'] }), qc.invalidateQueries({ queryKey: ['storefront'] })]);
      toast.success('Product deleted');
    } catch (error: any) { toast.error(error?.message ?? 'Delete failed'); }
  };

  return <div className="space-y-4">
    <div className="flex gap-2"><div className="relative flex-1"><Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search products" value={query} onChange={(event) => setQuery(event.target.value)} /></div><Button onClick={() => setEditing(emptyProduct)}><Plus className="size-4" />New product</Button></div>
    <div className="border bg-card overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead>Price</TableHead><TableHead>Stock</TableHead><TableHead>Shipping</TableHead><TableHead>Visible</TableHead><TableHead /></TableRow></TableHeader><TableBody>
      {isLoading ? <TableRow><TableCell colSpan={7}><Skeleton className="h-6" /></TableCell></TableRow> : rows.map((product) => {
        const divider = dividerName(product.category, product.subcategoryDividerId);
        const shippingLabel = product.shippingScope === 'variant' ? 'Per variant' : optionName(product.shippingOptionId);
        return <TableRow key={product.id} className={product.setupRequired ? 'bg-destructive/5' : undefined}>
          <TableCell><div className="font-medium">{product.name}</div>{(product.preorderEnabled || product.variants.some((v) => v.preorderEnabled)) && <div className="text-xs font-medium text-primary">Preorder enabled</div>}<div className="text-xs text-muted-foreground">{product.hasVariants ? `${product.variantCount} variants` : `${product.size}${product.purity ? ` · ${product.purity}` : ''}`}</div>{product.setupRequired && <div className="mt-1 flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3" />Shipping setup required</div>}</TableCell>
          <TableCell><div>{product.category || '—'}</div>{divider && <div className="text-xs text-muted-foreground">{divider}</div>}</TableCell>
          <TableCell className="font-mono">{product.minPrice === product.maxPrice ? usd(product.minPrice) : `${usd(product.minPrice)}–${usd(product.maxPrice)}`}</TableCell>
          <TableCell className="font-mono">{product.stockSummary ?? '∞'}</TableCell>
          <TableCell className={product.setupRequired ? 'text-destructive' : ''}>{shippingLabel}</TableCell>
          <TableCell>{product.active ? 'Yes' : 'Draft'}{product.featured && ' · ★'}{product.showCoa && ' · COA'}</TableCell>
          <TableCell className="text-right whitespace-nowrap"><Button variant="ghost" size="icon" onClick={() => setEditing(product)}><Pencil className="size-4" /></Button><ConfirmDelete what={product.name} onConfirm={() => remove(product.id)}><Button variant="ghost" size="icon"><Trash2 className="size-4" /></Button></ConfirmDelete></TableCell>
        </TableRow>;
      })}
    </TableBody></Table></div>
    {editing && <ProductDialog initial={editing} library={data?.images ?? []} onSave={save} onClose={() => setEditing(null)} />}
  </div>;
}
