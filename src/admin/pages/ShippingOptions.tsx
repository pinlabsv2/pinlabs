import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { manageShippingOptions, type ManageShippingOptionsOutputType } from '@/lib/api';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Label } from '@/ui-kit/ui/label';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/ui-kit/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui-kit/ui/table';
import ConfirmDelete from '../components/ConfirmDelete';
import { usd } from '../components/StatusBadge';

type Option = Pick<ManageShippingOptionsOutputType['options'][0], 'id' | 'name' | 'price'>;
type Draft = Omit<Option, 'id'> & { id?: string };

function OptionDialog({ initial, onSave, onClose }: { initial: Draft; onSave: (option: Draft) => Promise<void>; onClose: () => void }) {
  const [option, setOption] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (!option.name.trim()) return setError('Name is required');
    if (!Number.isFinite(option.price) || option.price < 0) return setError('Price must be zero or greater');
    setBusy(true);
    try { await onSave({ ...option, name: option.name.trim(), price: Math.round(option.price * 100) / 100 }); }
    finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent><DialogHeader><DialogTitle>{option.id ? 'Edit shipping option' : 'New shipping option'}</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>Name</Label><Input className="mt-1.5" value={option.name} onChange={(event) => setOption((current) => ({ ...current, name: event.target.value }))} placeholder="Germany Warehouse" /></div><div><Label>Price (USD)</Label><Input className="mt-1.5" type="number" min="0" step="0.01" value={option.price} onChange={(event) => setOption((current) => ({ ...current, price: Number(event.target.value) }))} /></div>{error && <p className="text-sm text-destructive">{error}</p>}</div><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={save}>Save</Button></DialogFooter></DialogContent></Dialog>;
}

export default function ShippingOptions() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['shipping-options'], queryFn: () => manageShippingOptions({ action: 'list' }) });
  const [editing, setEditing] = useState<Draft | null>(null);
  const mutate = async (input: Parameters<typeof manageShippingOptions>[0], message: string) => {
    try {
      const result = await manageShippingOptions(input);
      qc.setQueryData(['shipping-options'], result);
      await Promise.all([qc.invalidateQueries({ queryKey: ['products'] }), qc.invalidateQueries({ queryKey: ['storefront'] })]);
      setEditing(null);
      toast.success(message);
    } catch (error: any) { toast.error(error?.message ?? 'Request failed'); }
  };
  return <div className="space-y-4">
    <div className="flex items-start justify-between gap-4"><p className="max-w-2xl text-sm text-muted-foreground">Each option represents an origin or shipping service. Checkout charges each distinct option once, even when several products share it.</p><Button onClick={() => setEditing({ name: '', price: 0 })}><Plus className="size-4" />New option</Button></div>
    <div className="border bg-card overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Price</TableHead><TableHead>Assignments</TableHead><TableHead /></TableRow></TableHeader><TableBody>
      {isLoading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-6" /></TableCell></TableRow> : data?.options.length === 0 ? <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No shipping options yet.</TableCell></TableRow> : data?.options.map((option) => <TableRow key={option.id}><TableCell className="font-medium">{option.name}</TableCell><TableCell className="font-mono">{option.price === 0 ? 'Free' : usd(option.price)}</TableCell><TableCell className="text-sm text-muted-foreground">{option.assignmentCount} total · {option.productCount} products · {option.variantCount} variants</TableCell><TableCell className="text-right whitespace-nowrap"><Button variant="ghost" size="icon" onClick={() => setEditing(option)}><Pencil className="size-4" /></Button><ConfirmDelete what={option.name} onConfirm={() => mutate({ action: 'delete', id: option.id }, 'Shipping option deleted')}><Button variant="ghost" size="icon"><Trash2 className="size-4" /></Button></ConfirmDelete></TableCell></TableRow>)}
    </TableBody></Table></div>
    {editing && <OptionDialog initial={editing} onClose={() => setEditing(null)} onSave={(option) => mutate({ action: 'save', option }, 'Shipping option saved')} />}
  </div>;
}
