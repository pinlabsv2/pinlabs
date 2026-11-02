import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ghost, Loader2, CheckCircle2, XCircle, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { manageSettings, testWallets, type ManageSettingsOutputType, type TestWalletsOutputType } from '@/lib/api';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Label } from '@/ui-kit/ui/label';
import { Switch } from '@/ui-kit/ui/switch';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import { Textarea } from '@/ui-kit/ui/textarea';

type S = ManageSettingsOutputType['settings'];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label><div className="mt-1.5">{children}</div>{hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}</div>;
}

export default function Settings() {
  const qc = useQueryClient();
  const { data, isError, refetch } = useQuery({ queryKey: ['settings'], queryFn: () => manageSettings({}) });
  const [s, setS] = useState<S | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tests, setTests] = useState<TestWalletsOutputType['results'] | null>(null);
  useEffect(() => { if (data) setS(data.settings); }, [data]);
  if (isError) return <p className="text-sm text-destructive">Could not load settings. <button type="button" className="underline" onClick={() => refetch()}>Try again</button></p>;
  if (!s) return <Skeleton className="h-96" />;
  const set = (k: keyof S, v: any) => setS({ ...s, [k]: v });

  const save = async () => {
    const checks: [string, string, RegExp][] = [
      ['BTC', s.btcAddress, /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/],
      ['ETH', s.ethAddress, /^0x[a-fA-F0-9]{40}$/],
      ['SOL', s.solAddress, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/],
      ['LTC', s.ltcAddress, /^(ltc1|[LM3])[a-zA-HJ-NP-Z0-9]{25,62}$/],
      ['TRON', s.tronAddress, /^T[1-9A-HJ-NP-Za-km-z]{33}$/],
    ];
    const hex = /^#[0-9a-fA-F]{6}$/;
    if ((s.primaryColor && !hex.test(s.primaryColor)) || (s.accentColor && !hex.test(s.accentColor))) return toast.error('Colors must be hex like #F5664B');
    if (s.solanaRpcUrl.trim() && !/^https:\/\//.test(s.solanaRpcUrl.trim())) return toast.error('Solana RPC URL must start with https://');
    const bad = checks.find(([, v, re]) => v.trim() && !re.test(v.trim()));
    if (bad) return toast.error(`${bad[0]} address looks invalid`);
    setBusy(true);
    try { qc.setQueryData(['settings'], await manageSettings({ settings: { ...s, solAddress: s.solAddress.trim(), ltcAddress: s.ltcAddress.trim(), btcAddress: s.btcAddress.trim(), ethAddress: s.ethAddress.trim(), tronAddress: s.tronAddress.trim() } })); toast.success('Settings saved'); }
    catch (e: any) { toast.error(e?.message ?? 'Save failed'); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="font-semibold">Payment wallets</h3>
        {([
          ['btcAddress', 'Bitcoin (BTC)', 'Enables BTC.'],
          ['ethAddress', 'Ethereum (0x…)', 'Enables ETH, USDT (ERC-20) and USDC.'],
          ['solAddress', 'Solana (SOL)', 'Enables SOL.'],
          ['ltcAddress', 'Litecoin (LTC)', 'Enables LTC.'],
          ['tronAddress', 'Tron (T…)', 'Enables TRX and USDT (TRC-20).'],
        ] as const).map(([k, label, hint]) => (
          <Field key={k} label={label} hint={`${hint} Leave blank to disable.`}><Input className="font-mono" value={s[k]} onChange={(e) => set(k, e.target.value)} /></Field>
        ))}
        <div className="rounded-lg bg-muted/50 p-4 space-y-3">
          <div><p className="text-sm font-medium">Blockchain APIs</p>
            <p className="text-xs text-muted-foreground">Payments are detected automatically when a customer views their order or you open Orders. BTC (mempool.space) and LTC (litecoinspace.org) need no key. The others work without keys but are rate-limited — add free keys for reliability.</p></div>
          <Field label="Etherscan API key" hint="Free at etherscan.io/myapikey — used for ETH, USDT (ERC-20), USDC. Without it, Blockscout is used."><Input className="font-mono" value={s.etherscanApiKey} onChange={(e) => set('etherscanApiKey', e.target.value.trim())} /></Field>
          <Field label="TronGrid API key" hint="Free at trongrid.io — used for TRX and USDT (TRC-20)."><Input className="font-mono" value={s.tronGridApiKey} onChange={(e) => set('tronGridApiKey', e.target.value.trim())} /></Field>
          <Field label="Solana RPC URL" hint="Free from helius.dev (https://mainnet.helius-rpc.com/?api-key=…). The public RPC often blocks lookups."><Input className="font-mono" placeholder="https://api.mainnet-beta.solana.com" value={s.solanaRpcUrl} onChange={(e) => set('solanaRpcUrl', e.target.value)} /></Field>
          <Button variant="outline" size="sm" disabled={testing} onClick={async () => {
            setTesting(true);
            try { setTests((await testWallets({})).results); } catch (e: any) { toast.error(e?.message ?? 'Test failed'); } finally { setTesting(false); }
          }}>{testing ? <Loader2 className="size-4 animate-spin" /> : <Activity className="size-4" />}Test saved wallets</Button>
          {tests && (tests.length === 0 ? <p className="text-xs text-muted-foreground">No wallets saved yet.</p> : (
            <ul className="space-y-1 text-xs">{tests.map((t) => (
              <li key={t.currency} className="flex items-start gap-2">{t.ok ? <CheckCircle2 className="size-4 text-primary shrink-0" /> : <XCircle className="size-4 text-destructive shrink-0" />}
                <span className="font-mono font-semibold w-24 shrink-0">{t.currency}</span><span className="text-muted-foreground break-all">{t.message}</span></li>
            ))}</ul>
          ))}
          <p className="text-xs text-muted-foreground">Save settings before testing.</p>
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-dashed p-3 text-sm">
          <Switch checked={s.testMode} onCheckedChange={(v) => set('testMode', v)} />
          <span><span className="font-medium">Test mode</span><span className="block text-xs text-muted-foreground">Adds a "Skip payment" option at checkout that marks orders paid instantly. Turn off before launch.</span></span>
        </label>
      </section>
      <section className="rounded-xl border bg-card p-5 grid sm:grid-cols-2 gap-4">
        <h3 className="font-semibold sm:col-span-2">Store & shipping</h3>
        {([['primaryColor', 'Main color', 'Buttons, links, highlights'], ['accentColor', 'Accent color', 'Sale tags, promo banner, hovers']] as const).map(([k, label, hint]) => (
          <Field key={k} label={label} hint={s[k] ? hint : 'Using the theme color'}>
            <div className="flex gap-2 items-center">
              <Switch checked={!!s[k]} onCheckedChange={(on) => set(k, on ? (k === 'primaryColor' ? '#F5664B' : '#D9472B') : '')} aria-label={`Custom ${label}`} />
              {s[k] ? (<>
                <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(s[k]) ? s[k] : '#000000'} onChange={(e) => set(k, e.target.value.toUpperCase())} className="h-10 w-12 rounded-md border bg-background p-1 cursor-pointer" />
                <Input className="font-mono uppercase" value={s[k]} onChange={(e) => set(k, e.target.value)} />
              </>) : <span className="text-sm text-muted-foreground">Theme default</span>}
            </div>
          </Field>
        ))}
        <Field label="Store name"><Input value={s.storeName} onChange={(e) => set('storeName', e.target.value)} /></Field>
        <Field label="Admin email"><Input type="email" value={s.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} /></Field>
        <Field label="Shipping fee ($)"><Input type="number" value={s.shippingFee} onChange={(e) => set('shippingFee', Number(e.target.value))} /></Field>
        <Field label="Free shipping over ($)" hint="Blank = never free"><Input type="number" value={s.freeShippingOver ?? ''} onChange={(e) => set('freeShippingOver', e.target.value === '' ? null : Number(e.target.value))} /></Field>
      </section>
      <section className="rounded-xl border-2 border-promo/40 bg-promo/5 p-5 space-y-4">
        <div className="flex items-center gap-2"><Ghost className="size-5 text-promo" /><h3 className="font-semibold">Promotion banner</h3>
          <label className="ml-auto flex items-center gap-2 text-sm"><Switch checked={s.promoActive} onCheckedChange={(v) => set('promoActive', v)} />Show on shop</label></div>
        <Field label="Headline"><Input value={s.promoTitle} onChange={(e) => set('promoTitle', e.target.value)} /></Field>
        <Field label="Subtitle"><Input value={s.promoSubtitle} onChange={(e) => set('promoSubtitle', e.target.value)} /></Field>
        <Field label="Featured code" hint="Shown in the banner and pre-filled at checkout. Create the code under Discount codes."><Input className="font-mono uppercase" value={s.promoCode} onChange={(e) => set('promoCode', e.target.value.toUpperCase())} /></Field>
      </section>
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div><h3 className="font-semibold">Policies</h3><p className="text-xs text-muted-foreground">Shown on the shop's policy pages (linked in the footer). Markdown supported — blank lines start new paragraphs, "## " makes a heading.</p></div>
        {([['termsOfService', 'Terms of service'], ['privacyPolicy', 'Privacy policy'], ['shippingPolicy', 'Shipping policy'], ['refundPolicy', 'Refund policy']] as const).map(([k, label]) => (
          <Field key={k} label={label}><Textarea rows={6} value={s[k]} onChange={(e) => set(k, e.target.value)} /></Field>
        ))}
      </section>
      <Button onClick={save} disabled={busy} size="lg">{busy && <Loader2 className="size-4 animate-spin" />}Save settings</Button>
    </div>
  );
}
