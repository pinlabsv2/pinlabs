import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { manageProducts } from '@/lib/api';
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
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Draft | null>(null);
  const rows = useMemo(() => (data?.products ?? []).filter((p) => p.name.toLowerCase().includes(q.toLowerCase())), [data, q]);

  const save = async (product: Draft) => {
    try { qc.setQueryData(['products'], await manageProducts({ action: 'save', product })); setEditing(null); toast.success('Product saved'); }
    catch (e: any) { toast.error(e?.message ?? 'Save failed'); }
  };
  const remove = async (id: string) => {
    try { qc.setQueryData(['products'], await manageProducts({ action: 'delete', id })); toast.success('Product deleted'); }
    catch (e: any) { toast.error(e?.message ?? 'Delete failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Button onClick={() => setEditing(emptyProduct)}><Plus className="size-4" />New product</Button>
      </div>
      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Price</TableHead><TableHead>Stock</TableHead><TableHead>Visible</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6}><Skeleton className="h-6" /></TableCell></TableRow>
              : rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.size} · {p.purity}</div></TableCell>
                  <TableCell>{p.category}</TableCell>
                  <TableCell className="font-mono">{p.salePrice != null ? <><span className="line-through text-muted-foreground mr-1">{usd(p.price)}</span><span className="text-promo">{usd(p.salePrice)}</span></> : usd(p.price)}</TableCell>
                  <TableCell className="font-mono">{p.stock ?? '∞'}</TableCell>
                  <TableCell>{p.active ? 'Yes' : 'Hidden'}{p.featured && ' · ★'}{p.showCoa && ' · COA'}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(p)}><Pencil className="size-4" /></Button>
                    <ConfirmDelete what={p.name} onConfirm={() => remove(p.id)}><Button variant="ghost" size="icon"><Trash2 className="size-4" /></Button></ConfirmDelete>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      {editing && <ProductDialog initial={editing} library={data?.images ?? []} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}
