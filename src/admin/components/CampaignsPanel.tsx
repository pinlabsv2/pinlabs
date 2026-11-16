import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Megaphone, Plus, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { manageCampaigns, type ManageCampaignsInputType, type ManageCampaignsOutputType } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Label } from '@/ui-kit/ui/label';
import { Textarea } from '@/ui-kit/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-kit/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/ui-kit/ui/dialog';

type ListResult = Extract<ManageCampaignsOutputType, { action: 'list' }>;
type Campaign = ListResult['campaigns'][number];
type Draft = Extract<ManageCampaignsInputType, { action: 'save' }>['campaign'];
type Review = Extract<ManageCampaignsOutputType, { action: 'review' }>;

const emptyDraft: Draft = { name: '', subject: '', mode: 'structured', preheader: '', heading: '', bodyText: '', ctaLabel: '', ctaUrl: '', advancedHtml: '', advancedText: '', audienceType: 'customer_accounts' };
const toDraft = (campaign: Campaign): Draft => ({ id: campaign.id, name: campaign.name, subject: campaign.subject, mode: campaign.mode, preheader: campaign.preheader, heading: campaign.heading, bodyText: campaign.bodyText, ctaLabel: campaign.ctaLabel, ctaUrl: campaign.ctaUrl, advancedHtml: campaign.advancedHtml, advancedText: campaign.advancedText, audienceType: campaign.audienceType });

export default function CampaignsPanel({ adminEmail }: { adminEmail: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['campaigns'], queryFn: () => manageCampaigns({ action: 'list' }) });
  const campaigns = data?.action === 'list' ? data.campaigns : [];
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [testRecipient, setTestRecipient] = useState('');
  const [review, setReview] = useState<Review | null>(null);
  const selected = campaigns.find((campaign) => campaign.id === selectedId);
  const editable = !selected || selected.state === 'draft';

  useEffect(() => { if (!selectedId && campaigns[0]) setSelectedId(campaigns[0].id); }, [campaigns, selectedId]);
  useEffect(() => { if (selected) { setDraft(toDraft(selected)); setDirty(false); setAudienceCount(null); } }, [selected]);
  useEffect(() => { if (!testRecipient) setTestRecipient(adminEmail || user?.email || ''); }, [adminEmail, testRecipient, user?.email]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => { setDraft((current) => ({ ...current, [key]: value })); setDirty(true); setAudienceCount(null); setReview(null); };
  const refresh = async () => { await qc.invalidateQueries({ queryKey: ['campaigns'] }); };
  const save = async () => {
    setBusy('save');
    try { const result = await manageCampaigns({ action: 'save', campaign: draft }); if (result.action === 'save') { qc.setQueryData(['campaigns'], { action: 'list', campaigns: result.campaigns }); setSelectedId(result.id); setDirty(false); toast.success('Campaign draft saved'); } }
    catch (error: any) { toast.error(error?.message ?? 'Campaign save failed'); } finally { setBusy(''); }
  };
  const count = async () => {
    if (!selected || dirty) return;
    setBusy('count'); try { const result = await manageCampaigns({ action: 'count', id: selected.id }); if (result.action === 'count') setAudienceCount(result.count); }
    catch (error: any) { toast.error(error?.message ?? 'Could not count recipients'); } finally { setBusy(''); }
  };
  const test = async () => {
    if (!selected || dirty) return;
    setBusy('test'); try { const result = await manageCampaigns({ action: 'test', id: selected.id, recipient: testRecipient }); if (result.action === 'test') { toast.success(`Test accepted for ${result.recipient}`); await refresh(); } }
    catch (error: any) { toast.error(error?.message ?? 'Test failed'); } finally { setBusy(''); }
  };
  const openReview = async () => {
    if (!selected || dirty) return;
    setBusy('review'); try { const result = await manageCampaigns({ action: 'review', id: selected.id }); if (result.action === 'review') setReview(result); }
    catch (error: any) { toast.error(error?.message ?? 'Campaign is not ready'); } finally { setBusy(''); }
  };
  const confirm = async () => {
    if (!selected || !review) return;
    setBusy('confirm'); try { const result = await manageCampaigns({ action: 'confirm', id: selected.id, revision: review.revision, expectedCount: review.count, nonce: review.nonce }); if (result.action === 'confirm') { setReview(null); qc.setQueryData(['campaigns'], { action: 'list', campaigns: result.campaigns }); toast.success(`${result.queued} emails queued`); } }
    catch (error: any) { setReview(null); toast.error(error?.message ?? 'Confirmation failed'); } finally { setBusy(''); }
  };
  const cancel = async () => {
    if (!selected || !window.confirm(`Cancel ${selected.name}? Queued emails will be suppressed.`)) return;
    setBusy('cancel'); try { const result = await manageCampaigns({ action: 'cancel', id: selected.id }); if (result.action === 'cancel') qc.setQueryData(['campaigns'], { action: 'list', campaigns: result.campaigns }); }
    catch (error: any) { toast.error(error?.message ?? 'Cancel failed'); } finally { setBusy(''); }
  };

  if (isLoading) return <section className="border bg-card p-5">Loading campaigns…</section>;
  return <section className="border bg-card">
    <div className="flex items-center justify-between gap-4 border-b p-5"><div><h2 className="flex items-center gap-2 font-semibold"><Megaphone className="size-4" />Campaigns</h2><p className="mt-1 text-sm text-muted-foreground">Save a revision, send its test, review the live audience, then confirm once.</p></div><Button variant="outline" onClick={() => { setSelectedId('__new__'); setDraft(emptyDraft); setDirty(true); setAudienceCount(null); }}><Plus className="size-4" />New</Button></div>
    <div className="grid lg:grid-cols-[240px_1fr] min-h-[620px]">
      <nav className="border-b lg:border-b-0 lg:border-r p-2 space-y-1">{campaigns.length ? campaigns.map((campaign) => <button key={campaign.id} type="button" onClick={() => { if (!dirty || window.confirm('Discard unsaved campaign changes?')) setSelectedId(campaign.id); }} className={`w-full p-3 text-left text-sm ${selectedId === campaign.id ? 'bg-foreground text-background' : 'hover:bg-muted'}`}><span className="block font-medium">{campaign.name}</span><span className="block text-xs opacity-70">v{campaign.revision} · {campaign.state}</span><span className="block text-xs opacity-70">{campaign.counts.sent ?? 0} sent · {campaign.counts.failed ?? 0} failed</span></button>) : <p className="p-3 text-sm text-muted-foreground">No campaigns yet.</p>}</nav>
      <div className="p-5 space-y-4 min-w-0">
        <div className="flex items-center justify-between"><div><h3 className="font-semibold">{selected ? selected.name : 'New campaign'}</h3>{selected && <p className="text-xs text-muted-foreground">Revision {selected.revision} · {selected.state}</p>}</div>{selected && ['draft', 'queued', 'confirmed'].includes(selected.state) && <Button size="sm" variant="ghost" onClick={cancel} disabled={!!busy}><X className="size-4" />Cancel</Button>}</div>
        <div className="grid md:grid-cols-2 gap-4"><div><Label>Internal name</Label><Input className="mt-1" disabled={!editable} value={draft.name} onChange={(event) => update('name', event.target.value)} /></div><div><Label>Audience</Label><Select disabled={!editable} value={draft.audienceType} onValueChange={(value: Draft['audienceType']) => update('audienceType', value)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="customer_accounts">Customer accounts only</SelectItem><SelectItem value="all_accounts">All eligible accounts</SelectItem></SelectContent></Select></div></div>
        <div><Label>Subject</Label><Input className="mt-1" disabled={!editable} value={draft.subject} onChange={(event) => update('subject', event.target.value)} /></div>
        <div><Label>Mode</Label><Select disabled={!editable} value={draft.mode} onValueChange={(value: Draft['mode']) => update('mode', value)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="structured">Structured branded</SelectItem><SelectItem value="advanced_html">Advanced sanitized HTML</SelectItem></SelectContent></Select></div>
        <div><Label>Preheader</Label><Input className="mt-1" disabled={!editable} value={draft.preheader} onChange={(event) => update('preheader', event.target.value)} /></div>
        {draft.mode === 'structured' ? <><div><Label>Heading</Label><Input className="mt-1" disabled={!editable} value={draft.heading} onChange={(event) => update('heading', event.target.value)} /></div><div><Label>Body</Label><Textarea className="mt-1 min-h-36" disabled={!editable} value={draft.bodyText} onChange={(event) => update('bodyText', event.target.value)} /></div><div className="grid md:grid-cols-2 gap-4"><div><Label>Button label</Label><Input className="mt-1" disabled={!editable} value={draft.ctaLabel} onChange={(event) => update('ctaLabel', event.target.value)} /></div><div><Label>Button URL</Label><Input className="mt-1" disabled={!editable} value={draft.ctaUrl} onChange={(event) => update('ctaUrl', event.target.value)} /></div></div></> : <><div><Label>HTML</Label><Textarea className="mt-1 min-h-64 font-mono text-xs" disabled={!editable} value={draft.advancedHtml} onChange={(event) => update('advancedHtml', event.target.value)} /></div><div><Label>Plain text</Label><Textarea className="mt-1 min-h-32 font-mono text-xs" disabled={!editable} value={draft.advancedText} onChange={(event) => update('advancedText', event.target.value)} /></div></>}
        {editable && <div className="flex flex-wrap gap-2 border-t pt-4"><Button onClick={save} disabled={!!busy || !dirty}>{busy === 'save' && <Loader2 className="size-4 animate-spin" />}Save revision</Button>{selected && !dirty && <Button variant="outline" onClick={count} disabled={!!busy}>{busy === 'count' && <Loader2 className="size-4 animate-spin" />}Count audience</Button>}</div>}
        {audienceCount != null && <p className="text-sm"><b>{audienceCount}</b> currently eligible recipients.</p>}
        {selected?.state === 'draft' && !dirty && <div className="border-t pt-4 space-y-3"><Label>Test recipient</Label><div className="flex gap-2"><Input type="email" value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} /><Button variant="outline" onClick={test} disabled={!!busy || !testRecipient}>{busy === 'test' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Send exact test</Button></div><p className="text-xs text-muted-foreground">Only your admin address or the configured admin email is accepted.</p><Button onClick={openReview} disabled={!!busy || selected.testRevision !== selected.revision}>{busy === 'review' && <Loader2 className="size-4 animate-spin" />}Review and confirm</Button></div>}
      </div>
    </div>
    {review && <Dialog open onOpenChange={(open) => !open && setReview(null)}><DialogContent><DialogHeader><DialogTitle>Confirm campaign</DialogTitle></DialogHeader><div className="space-y-2 text-sm"><p><span className="text-muted-foreground">Subject:</span> {review.subject}</p><p><span className="text-muted-foreground">Audience:</span> {review.audienceType === 'all_accounts' ? 'All eligible accounts' : 'Customer accounts only'}</p><p><b>{review.count}</b> eligible recipients will be queued.</p><p className="text-muted-foreground">Test accepted for {review.testRecipient} at {new Date(review.testSentAt).toLocaleString()}.</p></div><DialogFooter><Button variant="outline" onClick={() => setReview(null)}>Back</Button><Button onClick={confirm} disabled={busy === 'confirm'}>{busy === 'confirm' && <Loader2 className="size-4 animate-spin" />}Confirm and queue {review.count}</Button></DialogFooter></DialogContent></Dialog>}
  </section>;
}
