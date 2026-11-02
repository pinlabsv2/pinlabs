import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { manageSupport, type ManageSupportOutputType } from '@/lib/api';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Label } from '@/ui-kit/ui/label';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/ui-kit/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-kit/ui/select';
import ConfirmDelete from '../components/ConfirmDelete';

type C = Omit<ManageSupportOutputType['contacts'][0], 'id'> & { id?: string };
const CHANNELS = ['Telegram', 'WhatsApp', 'Discord', 'Email'] as const;
const ICON: Record<string, string> = { Telegram: '✈️', WhatsApp: '💬', Discord: '🎮', Email: '✉️' };
const HINT: Record<string, string> = { Telegram: '@username', WhatsApp: '+48 123 456 789', Discord: 'Invite link or username', Email: 'support@example.com' };

export default function Support() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['support'], queryFn: () => manageSupport({ action: 'list' }) });
  const [edit, setEdit] = useState<C | null>(null);
  const [err, setErr] = useState('');

  const call = async (args: Parameters<typeof manageSupport>[0], ok: string) => {
    try { qc.setQueryData(['support'], await manageSupport(args)); toast.success(ok); return true; }
    catch (e: any) { toast.error(e?.message ?? 'Failed'); return false; }
  };
  const save = async () => {
    if (!edit) return;
    if (!edit.handle.trim()) return setErr('Enter a handle, number or address');
    if (edit.channel === 'Email' && !/^\S+@\S+\.\S+$/.test(edit.handle.trim())) return setErr('Enter a valid email');
    if (await call({ action: 'save', contact: { ...edit, handle: edit.handle.trim() } }, 'Contact saved')) { setEdit(null); setErr(''); }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">These appear on the shop's Support page.</p>
        <Button onClick={() => setEdit({ label: '', channel: 'Telegram', handle: '', sortOrder: (data?.contacts.length ?? 0) + 1 })}><Plus className="size-4" />Add contact</Button>
      </div>
      <div className="rounded-xl border bg-card divide-y">
        {isLoading ? <div className="p-4"><Skeleton className="h-6" /></div>
          : data?.contacts.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No support contacts yet.</p>
          : data?.contacts.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-xl">{ICON[c.channel]}</span>
              <div className="flex-1 min-w-0"><p className="font-medium">{c.label || c.channel}</p><p className="text-xs font-mono text-muted-foreground truncate">{c.handle}</p></div>
              <Button size="icon" variant="ghost" onClick={() => setEdit(c)}><Pencil className="size-4" /></Button>
              <ConfirmDelete what={c.label || c.handle} onConfirm={() => call({ action: 'delete', id: c.id }, 'Contact removed')}><Button size="icon" variant="ghost"><Trash2 className="size-4" /></Button></ConfirmDelete>
            </div>
          ))}
      </div>
      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{edit.id ? 'Edit contact' : 'New contact'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Channel</Label><Select value={edit.channel} onValueChange={(v) => setEdit({ ...edit, channel: v as C['channel'] })}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{CHANNELS.map((c) => <SelectItem key={c} value={c}>{ICON[c]} {c}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Label</Label><Input className="mt-1.5" placeholder="e.g. Order support" value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></div>
              <div><Label>Handle / number / address</Label><Input className="mt-1.5 font-mono" placeholder={HINT[edit.channel]} value={edit.handle} onChange={(e) => setEdit({ ...edit, handle: e.target.value })} /></div>
              <div><Label>Order</Label><Input className="mt-1.5" type="number" value={edit.sortOrder} onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) })} /></div>
              {err && <p className="text-sm text-destructive">{err}</p>}
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
