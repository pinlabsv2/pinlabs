import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Loader2, LogOut, Package } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { logout } from '@/lib/auth';
import { myAccount } from '@/lib/api';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Label } from '@/ui-kit/ui/label';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import AddressFields, { Address } from '../components/AddressFields';

const schema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name'),
  lastName: z.string().trim().min(1, 'Enter your last name'),
});

export default function Account() {
  const qc = useQueryClient();
  const { data, isError, refetch } = useQuery({ queryKey: ['account'], queryFn: () => myAccount({}) });
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [address, setAddress] = useState<Address>({ street: '', city: '', postalCode: '', country: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) { setFirst(data.profile.firstName); setLast(data.profile.lastName); setAddress(data.profile.address); } }, [data]);

  const save = async () => {
    const r = schema.safeParse({ firstName: first, lastName: last });
    if (!r.success) return setErrors(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
    setErrors({}); setBusy(true);
    try { qc.setQueryData(['account'], await myAccount({ save: { firstName: first, lastName: last, address } })); toast.success('Account saved'); }
    catch (e: any) { toast.error(e?.message ?? 'Save failed'); } finally { setBusy(false); }
  };

  if (isError) return <div className="container mx-auto px-4 py-10 max-w-2xl text-sm text-destructive">Could not load your account. <button type="button" className="underline" onClick={() => refetch()}>Try again</button></div>;
  if (!data) return <div className="container mx-auto px-4 py-10 max-w-2xl"><Skeleton className="h-96 rounded-xl" /></div>;
  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold">Account settings</h1><p className="text-sm text-muted-foreground font-mono">{data.email}</p></div>
        <Button variant="outline" asChild><Link to="/orders"><Package className="size-4" />My orders</Link></Button>
      </div>
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold">Profile</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>First name</Label><Input className="mt-1.5" value={first} onChange={(e) => setFirst(e.target.value)} />{errors.firstName && <p className="text-sm text-destructive mt-1">{errors.firstName}</p>}</div>
          <div><Label>Last name</Label><Input className="mt-1.5" value={last} onChange={(e) => setLast(e.target.value)} />{errors.lastName && <p className="text-sm text-destructive mt-1">{errors.lastName}</p>}</div>
        </div>
      </section>
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div><h2 className="font-semibold">Default shipping address</h2><p className="text-xs text-muted-foreground">Pre-filled at checkout.</p></div>
        <AddressFields value={address} onChange={setAddress} errors={{}} />
      </section>
      <div className="flex gap-2">
        <Button onClick={save} disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}Save changes</Button>
        <Button variant="ghost" onClick={() => logout()}><LogOut className="size-4" />Sign out</Button>
      </div>
    </div>
  );
}
