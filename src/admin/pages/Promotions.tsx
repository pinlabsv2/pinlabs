import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { manageCodes, manageSettings } from '@/lib/api';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Label } from '@/ui-kit/ui/label';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import { Switch } from '@/ui-kit/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-kit/ui/select';
import Discounts from './Discounts';

const empty = { promoActive: false, promoTitle: '', promoSubtitle: '', promoCode: '' };
type PromotionSettings = typeof empty;

export default function Promotions() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['settings', 'promotions'], queryFn: () => manageSettings({ section: 'promotions' }) });
  const { data: codes } = useQuery({ queryKey: ['codes'], queryFn: () => manageCodes({ action: 'list' }) });
  const [settings, setSettings] = useState<PromotionSettings>(empty);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data?.section === 'promotions') setSettings(data.settings as PromotionSettings); }, [data]);
  const activeCodes = useMemo(() => (codes?.codes ?? []).filter((code) => code.active), [codes]);
  const featuredExists = !settings.promoCode || activeCodes.some((code) => code.code === settings.promoCode);
  if (isLoading) return <Skeleton className="h-80" />;
  const save = async () => {
    setBusy(true);
    try {
      const result = await manageSettings({ section: 'promotions', settings });
      qc.setQueryData(['settings', 'promotions'], result);
      await qc.invalidateQueries({ queryKey: ['storefront'] });
      toast.success('Promotion banner saved');
    } catch (error: any) { toast.error(error?.message ?? 'Save failed'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-8">
    <section className="max-w-2xl border-2 border-promo/40 bg-promo/5 p-5 space-y-4">
      <div className="flex items-center gap-2"><Megaphone className="size-5 text-promo" /><h2 className="font-semibold">Promotion banner</h2><label className="ml-auto flex items-center gap-2 text-sm"><Switch checked={settings.promoActive} onCheckedChange={(value) => setSettings((current) => ({ ...current, promoActive: value }))} />Show on shop</label></div>
      <div><Label>Headline</Label><Input className="mt-1.5" value={settings.promoTitle} onChange={(event) => setSettings((current) => ({ ...current, promoTitle: event.target.value }))} /></div>
      <div><Label>Subtitle</Label><Input className="mt-1.5" value={settings.promoSubtitle} onChange={(event) => setSettings((current) => ({ ...current, promoSubtitle: event.target.value }))} /></div>
      <div><Label>Featured code</Label><Select value={settings.promoCode || 'none'} onValueChange={(value) => setSettings((current) => ({ ...current, promoCode: value === 'none' ? '' : value }))}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No featured code</SelectItem>{activeCodes.map((code) => <SelectItem key={code.id} value={code.code}>{code.code}</SelectItem>)}</SelectContent></Select>{!featuredExists && <p className="mt-1 text-xs text-destructive">The saved featured code is missing or inactive. Choose another before saving.</p>}</div>
      <Button disabled={busy || !featuredExists} onClick={save}>{busy && <Loader2 className="size-4 animate-spin" />}Save banner</Button>
    </section>
    <section><div className="mb-4"><h2 className="font-semibold">Promotion codes</h2><p className="text-sm text-muted-foreground">Create percentage or fixed discounts for checkout.</p></div><Discounts /></section>
  </div>;
}
