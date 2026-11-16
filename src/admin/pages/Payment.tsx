import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { manageSettings, testWallets, type TestWalletsOutputType } from '@/lib/api';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Label } from '@/ui-kit/ui/label';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import { Switch } from '@/ui-kit/ui/switch';

const empty = {
  btcAddress: '', ethAddress: '', solAddress: '', ltcAddress: '', tronAddress: '', testMode: false,
  etherscanApiKey: '', tronGridApiKey: '', solanaRpcUrl: '',
};
type PaymentSettings = typeof empty;

function Field({ label, hint, secret, value, onChange }: { label: string; hint?: string; secret?: boolean; value: string; onChange: (value: string) => void }) {
  return <div><Label>{label}</Label><Input type={secret ? 'password' : 'text'} className="mt-1.5 font-mono" value={value} onChange={(event) => onChange(event.target.value)} />{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</div>;
}

export default function Payment() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['settings', 'payment'], queryFn: () => manageSettings({ section: 'payment' }) });
  const [settings, setSettings] = useState<PaymentSettings>(empty);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tests, setTests] = useState<TestWalletsOutputType['results'] | null>(null);
  useEffect(() => { if (data?.section === 'payment') setSettings(data.settings as PaymentSettings); }, [data]);
  if (isLoading) return <Skeleton className="h-96" />;
  if (isError) return <p className="text-sm text-destructive">Could not load payment settings. <button className="underline" onClick={() => refetch()}>Try again</button></p>;
  const set = <K extends keyof PaymentSettings>(key: K, value: PaymentSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setBusy(true);
    try {
      const result = await manageSettings({ section: 'payment', settings });
      qc.setQueryData(['settings', 'payment'], result);
      toast.success('Payment settings saved');
    } catch (error: any) { toast.error(error?.message ?? 'Save failed'); }
    finally { setBusy(false); }
  };
  return <div className="max-w-2xl space-y-6">
    <section className="border bg-card p-5 space-y-4">
      <div><h2 className="font-semibold">Payment wallets</h2><p className="text-xs text-muted-foreground">Leave a wallet blank to disable its payment methods.</p></div>
      <Field label="Bitcoin (BTC)" value={settings.btcAddress} onChange={(value) => set('btcAddress', value)} />
      <Field label="Ethereum (ETH, USDT ERC-20, USDC)" value={settings.ethAddress} onChange={(value) => set('ethAddress', value)} />
      <Field label="Solana (SOL)" value={settings.solAddress} onChange={(value) => set('solAddress', value)} />
      <Field label="Litecoin (LTC)" value={settings.ltcAddress} onChange={(value) => set('ltcAddress', value)} />
      <Field label="Tron (TRX, USDT TRC-20)" value={settings.tronAddress} onChange={(value) => set('tronAddress', value)} />
    </section>
    <section className="border bg-card p-5 space-y-4">
      <div><h2 className="font-semibold">Blockchain lookups</h2><p className="text-xs text-muted-foreground">These values are used only by the server to detect incoming payments.</p></div>
      <Field secret label="Etherscan API key" value={settings.etherscanApiKey} onChange={(value) => set('etherscanApiKey', value)} />
      <Field secret label="TronGrid API key" value={settings.tronGridApiKey} onChange={(value) => set('tronGridApiKey', value)} />
      <Field label="Solana RPC URL" hint="Must use HTTPS." value={settings.solanaRpcUrl} onChange={(value) => set('solanaRpcUrl', value)} />
      <Button variant="outline" size="sm" disabled={testing} onClick={async () => {
        setTesting(true);
        try { setTests((await testWallets({})).results); } catch (error: any) { toast.error(error?.message ?? 'Test failed'); }
        finally { setTesting(false); }
      }}>{testing ? <Loader2 className="size-4 animate-spin" /> : <Activity className="size-4" />}Test saved wallets</Button>
      {tests && (tests.length === 0 ? <p className="text-xs text-muted-foreground">No wallets are saved.</p> : <ul className="space-y-1 text-xs">{tests.map((test) => <li key={test.currency} className="flex gap-2">{test.ok ? <CheckCircle2 className="size-4 text-primary" /> : <XCircle className="size-4 text-destructive" />}<span className="font-mono font-semibold w-24">{test.currency}</span><span className="text-muted-foreground break-all">{test.message}</span></li>)}</ul>)}
      <p className="text-xs text-muted-foreground">Save changes before testing.</p>
    </section>
    <label className="flex items-start gap-3 border border-dashed p-4 text-sm"><Switch checked={settings.testMode} onCheckedChange={(value) => set('testMode', value)} /><span><span className="font-medium">Test mode</span><span className="block text-xs text-muted-foreground">Adds a skip-payment checkout option. Keep this off in production.</span></span></label>
    <Button size="lg" disabled={busy} onClick={save}>{busy && <Loader2 className="size-4 animate-spin" />}Save payment settings</Button>
  </div>;
}
