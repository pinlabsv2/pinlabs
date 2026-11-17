import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { manageCategories } from '@/lib/api';
import { validCategoryColor } from '../../../shared/categoryColors';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';

export default function CategoryColorEditor() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['categories'], queryFn: () => manageCategories({action:'list'}) });
  const [drafts,setDrafts] = useState<Record<string,string>>({});
  const [busy,setBusy] = useState<string|null>(null);
  const save = async (category: NonNullable<typeof data>['categories'][0]) => {
    const color = drafts[category.id] ?? category.color;
    if (!validCategoryColor(color)) return toast.error('Use a six-digit hex color, for example #1EC474');
    setBusy(category.id);
    try {
      const result = await manageCategories({action:'colorSave',id:category.id,color});
      qc.setQueryData(['categories'],result);
      await qc.invalidateQueries({queryKey:['storefront']});
      setDrafts((current)=>{const next={...current};delete next[category.id];return next;});
      toast.success('Category color saved');
    } catch(error:any) { toast.error(error?.message ?? 'Could not save category color'); }
    finally { setBusy(null); }
  };
  return <section className="border bg-card p-5 space-y-4"><h2 className="text-lg font-medium">category colors</h2><p className="text-sm text-muted-foreground">These spectrum accents appear only with Colored Black: category filters, section bars, product markers and product category labels. Colors are saved individually and retained when you switch themes.</p>
    {isLoading ? <p className="text-sm">Loading categories…</p> : isError ? <Button variant="outline" onClick={()=>refetch()}>Retry categories</Button> : !data?.categories.length ? <p className="text-sm text-muted-foreground">Create categories in the Categories tab first.</p> : data.categories.map((category)=>{
      const color = drafts[category.id] ?? category.color;
      return <div key={category.id} className="flex flex-wrap gap-3 items-center border-t pt-3"><label className="flex-1 min-w-32 text-sm" htmlFor={`category-color-${category.id}`}>{category.name}</label><input type="color" aria-label={`${category.name} color picker`} value={validCategoryColor(color)?color:category.color} onChange={(e)=>setDrafts((current)=>({...current,[category.id]:e.target.value.toUpperCase()}))} className="h-10 w-12 border bg-background p-1"/><Input id={`category-color-${category.id}`} className="w-28 font-mono uppercase" value={color} maxLength={7} onChange={(e)=>setDrafts((current)=>({...current,[category.id]:e.target.value}))}/><Button size="sm" disabled={busy!==null || color.toUpperCase()===category.color.toUpperCase() || !validCategoryColor(color)} onClick={()=>save(category)}>{busy===category.id?'Saving…':'Save color'}</Button></div>;
    })}
  </section>;
}
