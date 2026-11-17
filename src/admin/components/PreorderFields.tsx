import { Input } from '@/ui-kit/ui/input';
import { Switch } from '@/ui-kit/ui/switch';

type Fields = { preorderEnabled?: boolean; preorderExpectedShipAt?: string | null };
export default function PreorderFields({ value, onChange, inherited = false }: { value: Fields; onChange: (patch: Fields) => void; inherited?: boolean }) {
  const date = value.preorderExpectedShipAt ? new Date(value.preorderExpectedShipAt) : null;
  const localDate = date && !Number.isNaN(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  return <div className="border p-3 space-y-2">
    <label className="flex gap-2 items-center text-sm"><Switch disabled={inherited} checked={inherited || !!value.preorderEnabled} onCheckedChange={(preorderEnabled) => onChange({ preorderEnabled })} />Preorder · pay in full now</label>
    {inherited ? <p className="text-xs text-muted-foreground">Inherits the product preorder and dispatch date.</p> : value.preorderEnabled && <label className="block text-sm">Expected dispatch (your local time)<Input type="datetime-local" value={localDate} onChange={(e) => onChange({ preorderExpectedShipAt: e.target.value ? new Date(e.target.value).toISOString() : null })} /><span className="text-xs text-muted-foreground">Stock is the finite preorder allocation, not on-hand inventory. Orders reserve these slots. Turn preorder off and reconcile stock when inventory arrives.</span></label>}
  </div>;
}
