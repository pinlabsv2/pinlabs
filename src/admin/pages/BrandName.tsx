import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { manageSettings } from '@/lib/api';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Label } from '@/ui-kit/ui/label';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import { Switch } from '@/ui-kit/ui/switch';

const empty = { storeName: 'PinLabs', primaryColor: '', accentColor: '' };
type BrandSettings = typeof empty;

export default function BrandName() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['settings', 'brand'], queryFn: () => manageSettings({ section: 'brand' }) });
  const [settings, setSettings] = useState<BrandSettings>(empty);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data?.section === 'brand') setSettings(data.settings as BrandSettings); }, [data]);
  if (isLoading) return <Skeleton className="h-80" />;
  const set = <K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setBusy(true);
    try {
      const result = await manageSettings({ section: 'brand', settings });
      qc.setQueryData(['settings', 'brand'], result);
      await qc.invalidateQueries({ queryKey: ['storefront'] });
      toast.success('Brand saved');
    } catch (error: any) { toast.error(error?.message ?? 'Save failed'); }
    finally { setBusy(false); }
  };
  return <div className="max-w-2xl space-y-6">
    <section className="border bg-card p-5 space-y-4">
      <div><Label>Brand name</Label><Input className="mt-1.5" value={settings.storeName} onChange={(event) => set('storeName', event.target.value)} /></div>
      {([['primaryColor', 'Primary color', '#F5664B'], ['accentColor', 'Accent color', '#D9472B']] as const).map(([key, label, fallback]) => <div key={key}>
        <Label>{label}</Label><div className="mt-1.5 flex items-center gap-2"><Switch checked={!!settings[key]} onCheckedChange={(enabled) => set(key, enabled ? fallback : '')} />
          {settings[key] ? <><input type="color" value={settings[key]} onChange={(event) => set(key, event.target.value.toUpperCase())} className="h-10 w-12 border bg-background p-1" /><Input className="font-mono uppercase" value={settings[key]} onChange={(event) => set(key, event.target.value)} /></> : <span className="text-sm text-muted-foreground">Theme default</span>}
        </div>
      </div>)}
    </section>
    <section className="border bg-background p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Preview</p>
      <div className="flex items-center gap-3 font-semibold text-lg"><span className="grid size-9 place-items-center bg-primary text-primary-foreground"><FlaskConical className="size-4" /></span>{settings.storeName || 'PinLabs'}</div>
      <div className="mt-5 flex gap-2"><Button type="button">Primary action</Button><span className="bg-promo text-promo-foreground px-3 py-2 text-sm font-medium">Accent label</span></div>
      <p className="mt-4 text-xs text-muted-foreground">This name also becomes the email sender display name; the verified address stays environment-controlled.</p>
    </section>
    <Button size="lg" disabled={busy} onClick={save}>{busy && <Loader2 className="size-4 animate-spin" />}Save brand</Button>
  </div>;
}
