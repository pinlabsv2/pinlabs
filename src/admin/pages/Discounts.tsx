import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { manageCodes, type ManageCodesOutputType } from '@/lib/api';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Label } from '@/ui-kit/ui/label';
import { Switch } from '@/ui-kit/ui/switch';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import { DateTimePicker } from '@/ui-kit/ui/date-picker';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/ui-kit/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-kit/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui-kit/ui/table';
import ConfirmDelete from '../components/ConfirmDelete';

type Code = Omit<ManageCodesOutputType['codes'][0], 'id'> & { id?: string };
const empty: Code = { code: '', discountType: 'Percent', amount: 10, minimumOrder: null, usageLimit: null, timesUsed: 0, expiresAt: null, active: true, note: '' };

function CodeDialog({ initial, onSave, onClose }: { initial: Code; onSave: (c: Code) => Promise<void>; onClose: () => void }) {
  const [c, setC] = useState(initial);
  const [err, setErr] = useState('');
  const set = (k: keyof Code, v: any) => setC({ ...c, [k]: v });
  const num = (v: string) => (v === '' ? null : Number(v));
  const save = () => {
    if (c.code.trim().length < 2) return setErr('Code must be at least 2 characters');
    if (c.discountType === 'Percent' && (c.amount <= 0 || c.amount > 100)) return setErr('Percent must be between 1 and 100');
    onSave(c);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{c.id ? 'Edit code' : 'New discount code'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Code</Label><Input className="font-mono uppercase" value={c.code} onChange={(e) => set('code', e.target.value.toUpperCase())} /></div>
          <div><Label>Type</Label><Select value={c.discountType} onValueChange={(v) => set('discountType', v)}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="Percent">Percent off</SelectItem><SelectItem value="Fixed">Fixed $ off</SelectItem></SelectContent></Select></div>
          <div><Label>{c.discountType === 'Percent' ? 'Percent' : 'Amount ($)'}</Label><Input type="number" value={c.amount} onChange={(e) => set('amount', Number(e.target.value))} /></div>
          <div><Label>Minimum order ($)</Label><Input type="number" value={c.minimumOrder ?? ''} onChange={(e) => set('minimumOrder', num(e.target.value))} /></div>
          <div><Label>Usage limit</Label><Input type="number" value={c.usageLimit ?? ''} placeholder="Unlimited" onChange={(e) => set('usageLimit', num(e.target.value))} /></div>
          <div className="col-span-2"><Label>Expires</Label><DateTimePicker value={c.expiresAt ? new Date(c.expiresAt) : undefined} onChange={(d) => set('expiresAt', d ? d.toISOString() : null)} /></div>
          <div className="col-span-2"><Label>Note</Label><Input value={c.note} onChange={(e) => set('note', e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={c.active} onCheckedChange={(v) => set('active', v)} />Active</label>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Discounts() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['codes'], queryFn: () => manageCodes({ action: 'list' }) });
  const [editing, setEditing] = useState<Code | null>(null);
  const mutate = async (args: Parameters<typeof manageCodes>[0], ok: string) => {
    try { qc.setQueryData(['codes'], await manageCodes(args)); setEditing(null); toast.success(ok); }
    catch (e: any) { toast.error(e?.message ?? 'Failed'); }
  };
  const toggle = (c: ManageCodesOutputType['codes'][0]) => mutate({ action: 'save', code: { ...c, active: !c.active } }, c.active ? 'Code paused' : 'Code activated');

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setEditing(empty)}><Plus className="size-4" />New code</Button></div>
      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Discount</TableHead><TableHead>Used</TableHead><TableHead>Expires</TableHead><TableHead>Active</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6}><Skeleton className="h-6" /></TableCell></TableRow>
              : data?.codes.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No codes yet.</TableCell></TableRow>
              : data?.codes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell><div className="font-mono font-semibold">{c.code}</div><div className="text-xs text-muted-foreground">{c.note}</div></TableCell>
                  <TableCell>{c.discountType === 'Percent' ? `${c.amount}%` : `$${c.amount}`}{c.minimumOrder ? <span className="text-xs text-muted-foreground"> · min ${c.minimumOrder}</span> : null}</TableCell>
                  <TableCell className="font-mono">{c.timesUsed}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</TableCell>
                  <TableCell className="text-sm">{c.expiresAt ? new Date(c.expiresAt).toLocaleString() : 'Never'}</TableCell>
                  <TableCell><Switch checked={c.active} onCheckedChange={() => toggle(c)} /></TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(c)}><Pencil className="size-4" /></Button>
                    <ConfirmDelete what={c.code} onConfirm={() => mutate({ action: 'delete', id: c.id }, 'Code deleted')}><Button variant="ghost" size="icon"><Trash2 className="size-4" /></Button></ConfirmDelete>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      {editing && <CodeDialog initial={editing} onClose={() => setEditing(null)} onSave={(code) => mutate({ action: 'save', code }, 'Code saved')} />}
    </div>
  );
}
