import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { manageCategories } from '@/lib/api';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import ConfirmDelete from '../components/ConfirmDelete';

export default function Categories() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['categories'], queryFn: () => manageCategories({ action: 'list' }) });
  const [name, setName] = useState('');
  const [edit, setEdit] = useState<{ id: string; name: string; sortOrder: number } | null>(null);

  const call = async (args: Parameters<typeof manageCategories>[0], ok: string) => {
    try { qc.setQueryData(['categories'], await manageCategories(args)); qc.invalidateQueries({ queryKey: ['products'] }); toast.success(ok); return true; }
    catch (e: any) { toast.error(e?.userFacingMessage ?? e?.message ?? 'Failed'); return false; }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (await call({ action: 'save', name, sortOrder: (data?.categories.length ?? 0) + 1 }, 'Category added')) setName(''); }}>
        <Input placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={!name.trim()}><Plus className="size-4" />Add</Button>
      </form>
      <div className="rounded-xl border bg-card divide-y">
        {isLoading ? <div className="p-4"><Skeleton className="h-6" /></div>
          : data?.categories.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No categories yet.</p>
          : data?.categories.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              {edit?.id === c.id ? (
                <>
                  <Input type="number" className="w-20" value={edit!.sortOrder} onChange={(e) => setEdit({ ...edit!, sortOrder: Number(e.target.value) })} />
                  <Input className="flex-1" autoFocus value={edit!.name} onChange={(e) => setEdit({ ...edit!, name: e.target.value })} />
                  <Button size="icon" variant="ghost" onClick={async () => { if (await call({ action: "save", ...edit! }, "Category updated")) setEdit(null); }}><Check className="size-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEdit(null)}><X className="size-4" /></Button>
                </>
              ) : (
                <>
                  <span className="w-8 font-mono text-xs text-muted-foreground">#{c.sortOrder}</span>
                  <span className="flex-1 font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.productCount} products</span>
                  <Button size="icon" variant="ghost" onClick={() => setEdit({ id: c.id, name: c.name, sortOrder: c.sortOrder })}><Pencil className="size-4" /></Button>
                  <ConfirmDelete what={c.name} onConfirm={() => call({ action: 'delete', id: c.id }, 'Category removed')}><Button size="icon" variant="ghost"><Trash2 className="size-4" /></Button></ConfirmDelete>
                </>
              )}
            </div>
          ))}
      </div>
      <p className="text-xs text-muted-foreground">Renaming a category updates all its products. The number sets the order of the filter chips in the shop.</p>
    </div>
  );
}
