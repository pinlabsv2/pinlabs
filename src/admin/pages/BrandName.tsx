import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { manageSettings, type ManageSettingsOutputType } from '@/lib/api';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Label } from '@/ui-kit/ui/label';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import { Switch } from '@/ui-kit/ui/switch';

import CategoryColorEditor from '../components/CategoryColorEditor';
import SeasonPreviewFrame from '../components/SeasonPreviewFrame';
import { seasonalDefaults, intensities, seasons, seasonLabels, type Season } from '@/shared/seasons';

const empty = { ...seasonalDefaults, minimumAge: 18 as 18 | 21, storeName: 'PinLabs', primaryColor: '', accentColor: '' };
type BrandSettings = Extract<ManageSettingsOutputType, { section: 'brand' }>['settings'];
const localDate = (value: string) => value ? new Date(Date.parse(value) - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0,16) : '';

export default function BrandName() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['settings', 'brand'], queryFn: () => manageSettings({ section: 'brand' }) });
  const [settings, setSettings] = useState<BrandSettings>(empty);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data?.section === 'brand') setSettings(data.settings as BrandSettings); }, [data]);
  if (isError) return <Button onClick={() => refetch()}>Retry loading brand settings</Button>;
  if (isLoading) return <Skeleton className="h-80" />;
  const set = <K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (settings.themeStartsAt && settings.themeEndsAt && Date.parse(settings.themeEndsAt) <= Date.parse(settings.themeStartsAt)) return toast.error('Theme end must be after its start.');
    setBusy(true);
    try {
      const result = await manageSettings({ section: 'brand', settings });
      qc.setQueryData(['settings', 'brand'], result);
      await qc.invalidateQueries({ queryKey: ['storefront'] });
      toast.success('Brand saved');
    } catch (error: any) { toast.error(error?.message ?? 'Save failed'); }
    finally { setBusy(false); }
  };
  return <div className="max-w-6xl space-y-6">
    <section className="border bg-card p-5 space-y-4">
      <div><Label htmlFor="seasonal-theme">Seasonal theme</Label><select id="seasonal-theme" className="mt-1.5 w-full border bg-background p-2" value={settings.seasonalTheme} onChange={(e) => set('seasonalTheme', e.target.value as Season)}>{seasons.map((id) => <option key={id} value={id}>{seasonLabels[id]}</option>)}</select><p className="mt-2 text-xs text-muted-foreground">Complete seasonal scenes, card treatments, typography, navigation decorations and ambient effects. Custom colors below override the palette.</p></div>
      {settings.seasonalTheme!=='colored-black' && <><div className="grid sm:grid-cols-2 gap-4"><div><Label htmlFor="theme-intensity">Effect intensity</Label><select id="theme-intensity" className="mt-1.5 w-full border bg-background p-2" value={settings.themeIntensity} onChange={(e) => set('themeIntensity', e.target.value as BrandSettings['themeIntensity'])}>{intensities.map((v)=><option key={v} value={v}>{v}</option>)}</select></div><label className="flex items-center gap-3 text-sm"><Switch checked={settings.themeMotion} onCheckedChange={(value)=>set('themeMotion',value)}/>Allow ambient animation</label></div>
      <p className="text-xs text-muted-foreground">Visitors can turn motion off. Device reduced-motion preferences always take precedence.</p></>}
      <div className="grid sm:grid-cols-2 gap-4">{([['themeStartsAt','Start showing theme'],['themeEndsAt','Return to original theme'],['themeCountdownAt','Optional event countdown']] as const).filter(([key])=>settings.seasonalTheme!=='colored-black'||key!=='themeCountdownAt').map(([key,label])=><div key={key}><Label htmlFor={key}>{label}</Label><Input id={key} type="datetime-local" className="mt-1.5" value={localDate(settings[key])} onChange={(e)=>set(key,e.target.value?new Date(e.target.value).toISOString():'')}/></div>)}</div>
      <p className="text-xs text-muted-foreground">Times use your browser’s local time, stored as UTC. Blank start means now; blank end means no automatic end. Scheduling works without cron. A countdown is display-only and does not create or expire a discount.</p>
      {settings.seasonalTheme!=='colored-black' && ([['themeHeadline','Seasonal headline (optional)'],['themeSubtitle','Seasonal description (optional)'],['themeAnnouncement','Announcement (optional)']] as const).map(([key,label])=><div key={key}><Label htmlFor={key}>{label}</Label><Input id={key} className="mt-1.5" value={settings[key]} maxLength={key==='themeHeadline'?120:key==='themeSubtitle'?300:180} placeholder="Use the theme’s default copy" onChange={(e)=>set(key,e.target.value)}/></div>)}
      <div><Label htmlFor="minimum-age">Minimum visitor age</Label><select id="minimum-age" className="mt-1.5 w-full border bg-background p-2" value={settings.minimumAge} onChange={(e) => set('minimumAge', Number(e.target.value) as 18 | 21)}><option value={18}>18+</option><option value={21}>21+</option></select><p className="mt-2 text-xs text-muted-foreground">Store eligibility rule; local restrictions may require a higher age. This is a self-declaration, not identity verification.</p></div>
      <div><Label>Brand name</Label><Input className="mt-1.5" value={settings.storeName} onChange={(event) => set('storeName', event.target.value)} /></div>
      {([['primaryColor', 'Primary color', '#F5664B'], ['accentColor', 'Accent color', '#D9472B']] as const).map(([key, label, fallback]) => <div key={key}>
        <Label>{label}</Label><div className="mt-1.5 flex items-center gap-2"><Switch checked={!!settings[key]} onCheckedChange={(enabled) => set(key, enabled ? fallback : '')} />
          {settings[key] ? <><input type="color" value={settings[key]} onChange={(event) => set(key, event.target.value.toUpperCase())} className="h-10 w-12 border bg-background p-1" /><Input className="font-mono uppercase" value={settings[key]} onChange={(event) => set(key, event.target.value)} /></> : <span className="text-sm text-muted-foreground">Theme default</span>}
        </div>
      </div>)}
    </section>
    {settings.seasonalTheme==='colored-black' && <><p className="text-sm text-muted-foreground">Colored Black uses the original storefront layout with warm charcoal surfaces and light text. No seasonal scenes, decorations or particles.</p><CategoryColorEditor/></>}
    <SeasonPreviewFrame settings={settings}/>
    <p className="text-xs text-muted-foreground">Brand name also becomes the email sender display name; the verified address stays environment-controlled.</p>
    <Button size="lg" disabled={busy} onClick={save}>{busy && <Loader2 className="size-4 animate-spin" />}Save brand</Button>
  </div>;
}
