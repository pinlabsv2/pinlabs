import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { manageCategories } from '@/lib/api';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import ConfirmDelete from '../components/ConfirmDelete';

type CategoryDraft = { id?: string; name: string; sortOrder: number };
type DividerDraft = { id?: string; categoryId: string; name: string; sortOrder: number };

export default function Categories() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['categories'], queryFn: () => manageCategories({ action: 'list' }) });
  const [newName, setNewName] = useState('');
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [dividerDraft, setDividerDraft] = useState<DividerDraft | null>(null);

  const call = async (input: Parameters<typeof manageCategories>[0], message: string) => {
    try {
      const result = await manageCategories(input);
      qc.setQueryData(['categories'], result);
      await Promise.all([qc.invalidateQueries({ queryKey: ['products'] }), qc.invalidateQueries({ queryKey: ['storefront'] })]);
      toast.success(message);
      return true;
    } catch (error: any) { toast.error(error?.message ?? 'Request failed'); return false; }
  };

  return <div className="max-w-3xl space-y-4">
    <form className="flex gap-2" onSubmit={async (event) => { event.preventDefault(); if (await call({ action: 'save', name: newName, sortOrder: data?.categories.length ?? 0 }, 'Category added')) setNewName(''); }}><Input placeholder="New category name" value={newName} onChange={(event) => setNewName(event.target.value)} /><Button type="submit" disabled={!newName.trim()}><Plus className="size-4" />Add category</Button></form>
    <p className="text-sm text-muted-foreground">Dividers are visual separators inside a category. They organize the catalog but never appear as filter chips.</p>
    <div className="border bg-card divide-y">
      {isLoading ? <div className="p-4"><Skeleton className="h-6" /></div> : data?.categories.length === 0 ? <p className="p-8 text-center text-muted-foreground">No categories yet.</p> : data?.categories.map((category) => <section key={category.id} className="p-4 space-y-3">
        {categoryDraft?.id === category.id ? <div className="flex items-center gap-2"><Input type="number" min="0" className="w-20" value={categoryDraft.sortOrder} onChange={(event) => setCategoryDraft({ ...categoryDraft, sortOrder: Number(event.target.value) })} /><Input className="flex-1" value={categoryDraft.name} onChange={(event) => setCategoryDraft({ ...categoryDraft, name: event.target.value })} /><Button size="icon" variant="ghost" onClick={async () => { if (await call({ action: 'save', ...categoryDraft }, 'Category updated')) setCategoryDraft(null); }}><Check className="size-4" /></Button><Button size="icon" variant="ghost" onClick={() => setCategoryDraft(null)}><X className="size-4" /></Button></div> : <div className="flex items-center gap-3"><span className="w-8 font-mono text-xs text-muted-foreground">#{category.sortOrder}</span><span className="flex-1 font-medium">{category.name}</span><span className="text-xs text-muted-foreground">{category.productCount} products · {category.dividers.length} dividers</span><Button size="sm" variant="outline" onClick={() => setDividerDraft({ categoryId: category.id, name: '', sortOrder: category.dividers.length })}><Plus className="size-4" />Divider</Button><Button size="icon" variant="ghost" onClick={() => setCategoryDraft({ id: category.id, name: category.name, sortOrder: category.sortOrder })}><Pencil className="size-4" /></Button><ConfirmDelete what={category.name} onConfirm={() => call({ action: 'delete', id: category.id }, 'Category deleted')}><Button size="icon" variant="ghost"><Trash2 className="size-4" /></Button></ConfirmDelete></div>}

        <div className="ml-8 border-l pl-4 space-y-2">
          {category.dividers.map((divider) => dividerDraft?.id === divider.id ? <div key={divider.id} className="flex items-center gap-2"><span className="size-2 shrink-0 bg-foreground" /><Input type="number" min="0" className="w-20" value={dividerDraft.sortOrder} onChange={(event) => setDividerDraft({ ...dividerDraft, sortOrder: Number(event.target.value) })} /><Input className="flex-1" value={dividerDraft.name} onChange={(event) => setDividerDraft({ ...dividerDraft, name: event.target.value })} /><Button size="icon" variant="ghost" onClick={async () => { if (await call({ action: 'dividerSave', ...dividerDraft }, 'Divider updated')) setDividerDraft(null); }}><Check className="size-4" /></Button><Button size="icon" variant="ghost" onClick={() => setDividerDraft(null)}><X className="size-4" /></Button></div> : <div key={divider.id} className="flex items-center gap-3 py-1"><span className="size-2 shrink-0 bg-foreground" /><span className="w-8 font-mono text-xs text-muted-foreground">#{divider.sortOrder}</span><span className="flex-1 text-sm">{divider.name}</span><span className="text-xs text-muted-foreground">{divider.productCount} products</span><Button size="icon" variant="ghost" onClick={() => setDividerDraft({ id: divider.id, categoryId: category.id, name: divider.name, sortOrder: divider.sortOrder })}><Pencil className="size-4" /></Button><ConfirmDelete what={divider.name} onConfirm={() => call({ action: 'dividerDelete', id: divider.id }, 'Divider deleted')}><Button size="icon" variant="ghost"><Trash2 className="size-4" /></Button></ConfirmDelete></div>)}
          {dividerDraft && !dividerDraft.id && dividerDraft.categoryId === category.id && <div className="flex items-center gap-2"><span className="size-2 shrink-0 bg-foreground" /><Input type="number" min="0" className="w-20" value={dividerDraft.sortOrder} onChange={(event) => setDividerDraft({ ...dividerDraft, sortOrder: Number(event.target.value) })} /><Input autoFocus className="flex-1" placeholder="Divider name" value={dividerDraft.name} onChange={(event) => setDividerDraft({ ...dividerDraft, name: event.target.value })} /><Button size="icon" variant="ghost" onClick={async () => { if (await call({ action: 'dividerSave', ...dividerDraft }, 'Divider added')) setDividerDraft(null); }}><Check className="size-4" /></Button><Button size="icon" variant="ghost" onClick={() => setDividerDraft(null)}><X className="size-4" /></Button></div>}
          {!category.dividers.length && !(dividerDraft && !dividerDraft.id && dividerDraft.categoryId === category.id) && <p className="text-xs text-muted-foreground py-1">No visual dividers in this category.</p>}
        </div>
      </section>)}
    </div>
  </div>;
}
