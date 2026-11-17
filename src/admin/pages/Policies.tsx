import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { manageSettings } from '@/lib/api';
import { Button } from '@/ui-kit/ui/button';
import { Label } from '@/ui-kit/ui/label';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import { policyDrafts } from '@/shared/policyTemplates';
import { Textarea } from '@/ui-kit/ui/textarea';

const empty = { termsOfService: '', privacyPolicy: '', shippingPolicy: '', refundPolicy: '' };
type PolicySettings = typeof empty;

export default function Policies() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['settings', 'policies'], queryFn: () => manageSettings({ section: 'policies' }) });
  const { data: brand } = useQuery({ queryKey: ['settings', 'brand'], queryFn: () => manageSettings({ section: 'brand' }) });
  const [settings, setSettings] = useState<PolicySettings>(empty);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data?.section === 'policies') setSettings(data.settings as PolicySettings); }, [data]);
  if (isLoading) return <Skeleton className="h-96" />;
  const save = async () => {
    if (Object.values(settings).some((value) => value.includes('[COMPLETE:'))) return toast.error('Complete all marked business, contact, delivery and retention details before publishing.');
    setBusy(true);
    try {
      const result = await manageSettings({ section: 'policies', settings });
      qc.setQueryData(['settings', 'policies'], result);
      await qc.invalidateQueries({ queryKey: ['storefront'] });
      toast.success('Policies saved');
    } catch (error: any) { toast.error(error?.message ?? 'Save failed'); }
    finally { setBusy(false); }
  };
  return <div className="max-w-3xl space-y-5">
    <p className="text-sm text-muted-foreground">These pages are linked from the shop footer. Markdown headings and paragraphs are supported.</p>
    <section className="border p-4 space-y-2"><h2 className="font-medium">Research-only policy templates</h2><p className="text-sm text-muted-foreground">Editable drafts covering laboratory restrictions, preorders, privacy and mandatory rights. Complete all [COMPLETE: …] markers and obtain local legal review before publishing.</p><Button variant="outline" onClick={() => {
      if (!window.confirm('Replace all four editor drafts? Published policies change only when you save.')) return;
      setSettings(policyDrafts(brand?.section === 'brand' ? brand.settings.storeName : 'PinLabs', brand?.section === 'brand' ? brand.settings.minimumAge : 18));
    }}>Load recommended drafts</Button></section>
    {([['termsOfService', 'Terms of service'], ['privacyPolicy', 'Privacy policy'], ['shippingPolicy', 'Shipping policy'], ['refundPolicy', 'Refund policy']] as const).map(([key, label]) => <section key={key} className="border bg-card p-5"><Label>{label}</Label><Textarea className="mt-2" rows={9} value={settings[key]} onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.value }))} /></section>)}
    <Button size="lg" disabled={busy} onClick={save}>{busy && <Loader2 className="size-4 animate-spin" />}Save policies</Button>
  </div>;
}
