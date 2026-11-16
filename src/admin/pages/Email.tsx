import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Loader2, Mail, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { manageEmailTemplates, manageSettings, type ManageEmailTemplatesInputType, type ManageEmailTemplatesOutputType } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Label } from '@/ui-kit/ui/label';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import { Switch } from '@/ui-kit/ui/switch';
import { Textarea } from '@/ui-kit/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-kit/ui/select';
import CampaignsPanel from '../components/CampaignsPanel';

type ListResult = Extract<ManageEmailTemplatesOutputType, { action: 'list' }>;
type Template = ListResult['templates'][number];
type TemplateDraft = Extract<ManageEmailTemplatesInputType, { action: 'save' }>['template'];

const draftFrom = (template: Template): TemplateDraft => ({
  templateKey: template.templateKey,
  mode: template.mode,
  subject: template.subject,
  preheader: template.preheader,
  heading: template.heading,
  bodyText: template.bodyText,
  ctaLabel: template.ctaLabel,
  ctaUrlTemplate: template.ctaUrlTemplate,
  advancedHtml: template.advancedHtml,
  advancedText: template.advancedText,
  enabled: template.enabled,
});

export default function Email() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: settingsData, isLoading: settingsLoading } = useQuery({ queryKey: ['settings', 'email'], queryFn: () => manageSettings({ section: 'email' }) });
  const { data: templateData, isLoading: templatesLoading } = useQuery({ queryKey: ['email-templates'], queryFn: () => manageEmailTemplates({ action: 'list' }) });
  const [adminEmail, setAdminEmail] = useState('');
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [selectedKey, setSelectedKey] = useState('');
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; html: string; text: string } | null>(null);
  const [templateBusy, setTemplateBusy] = useState<'save' | 'preview' | 'test' | null>(null);
  const [testRecipient, setTestRecipient] = useState('');

  const list = templateData?.action === 'list' ? templateData : undefined;
  const templates = list?.templates ?? [];
  const selected = useMemo(() => templates.find((template) => template.templateKey === selectedKey), [templates, selectedKey]);

  useEffect(() => {
    if (settingsData?.section === 'email') setAdminEmail((settingsData.settings as { adminEmail: string }).adminEmail);
  }, [settingsData]);
  useEffect(() => {
    if (!testRecipient) setTestRecipient(adminEmail || user?.email || '');
  }, [adminEmail, testRecipient, user?.email]);
  useEffect(() => {
    if (!selectedKey && templates[0]) setSelectedKey(templates[0].templateKey);
  }, [selectedKey, templates]);
  useEffect(() => {
    if (!selected) return;
    setDraft(draftFrom(selected));
    setDirty(false);
    setPreview(null);
  }, [selected]);

  if (settingsLoading || templatesLoading) return <Skeleton className="h-72" />;

  const saveSettings = async () => {
    setSettingsBusy(true);
    try {
      const result = await manageSettings({ section: 'email', settings: { adminEmail } });
      qc.setQueryData(['settings', 'email'], result);
      toast.success('Email settings saved');
    } catch (error: any) { toast.error(error?.message ?? 'Save failed'); }
    finally { setSettingsBusy(false); }
  };

  const updateDraft = <K extends keyof TemplateDraft>(key: K, value: TemplateDraft[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
    setDirty(true);
    setPreview(null);
  };

  const renderPreview = async () => {
    if (!draft) return;
    setTemplateBusy('preview');
    try {
      const result = await manageEmailTemplates({ action: 'preview', template: draft });
      if (result.action === 'preview') setPreview(result.preview);
    } catch (error: any) { toast.error(error?.message ?? 'Preview failed'); }
    finally { setTemplateBusy(null); }
  };

  const saveTemplate = async () => {
    if (!draft) return;
    setTemplateBusy('save');
    try {
      const result = await manageEmailTemplates({ action: 'save', template: draft });
      if (result.action === 'save') {
        await qc.invalidateQueries({ queryKey: ['email-templates'] });
        setDirty(false);
        toast.success(`Template saved as version ${result.template.version}`);
      }
    } catch (error: any) { toast.error(error?.message ?? 'Template save failed'); }
    finally { setTemplateBusy(null); }
  };

  const sendTest = async () => {
    if (!draft || dirty) return;
    setTemplateBusy('test');
    try {
      const result = await manageEmailTemplates({ action: 'test', templateKey: draft.templateKey, recipient: testRecipient });
      if (result.action === 'test') toast.success(`Test accepted for ${result.recipient}`);
    } catch (error: any) { toast.error(error?.message ?? 'Test send failed'); }
    finally { setTemplateBusy(null); }
  };

  return <div className="max-w-6xl space-y-6">
    <section className="border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2"><Mail className="size-5" /><h2 className="font-semibold">Sender & alerts</h2></div>
      <div><Label>Admin email</Label><Input type="email" className="mt-1.5" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="orders@example.com" /><p className="mt-1 text-xs text-muted-foreground">Receives new-order and payment alerts. It is also the reply-to fallback when EMAIL_REPLY_TO is not configured.</p></div>
      <div className="border border-dashed p-4 text-sm text-muted-foreground"><p>The verified sender address and Resend API key are configured through environment variables and are never exposed here.</p><p className="mt-2">Brand Name controls the sender display name and email colors.</p>{list && <p className="mt-2">Provider: <span className="font-medium text-foreground">{list.providerMode === 'live' ? 'Resend live' : 'Fake capture'}</span> · Sender address: <span className="font-medium text-foreground">{list.senderConfigured ? 'configured' : 'not configured'}</span></p>}</div>
      <Button disabled={settingsBusy} onClick={saveSettings}>{settingsBusy && <Loader2 className="size-4 animate-spin" />}Save email settings</Button>
    </section>

    <section className="border bg-card">
      <div className="border-b p-5"><h2 className="font-semibold">Transactional templates</h2><p className="mt-1 text-sm text-muted-foreground">Edit branded messages, preview with safe example data, then send a test of the saved version.</p></div>
      {!templates.length ? <p className="p-8 text-center text-muted-foreground">No transactional templates are configured.</p> : <div className="grid lg:grid-cols-[240px_1fr] min-h-[620px]">
        <nav className="border-b lg:border-b-0 lg:border-r p-2 space-y-1" aria-label="Email templates">
          {templates.map((template) => <button key={template.templateKey} type="button" onClick={() => { if (!dirty || window.confirm('Discard unsaved template changes?')) setSelectedKey(template.templateKey); }} className={`w-full p-3 text-left text-sm transition ${selectedKey === template.templateKey ? 'bg-foreground text-background' : 'hover:bg-muted'}`}><span className="block font-medium">{template.name}</span><span className={`block mt-1 text-xs ${selectedKey === template.templateKey ? 'text-background/70' : 'text-muted-foreground'}`}>v{template.version} · {template.enabled ? 'enabled' : 'disabled'}</span></button>)}
        </nav>
        {draft && selected && <div className="p-5 space-y-5 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{selected.name}</h3><p className="text-xs font-mono text-muted-foreground">{selected.templateKey} · version {selected.version}</p></div><label className="flex items-center gap-2 text-sm"><Switch checked={draft.enabled} onCheckedChange={(enabled) => updateDraft('enabled', enabled)} />Enabled</label></div>
          <div><Label>Editor mode</Label><Select value={draft.mode} onValueChange={(mode: 'structured' | 'advanced_html') => updateDraft('mode', mode)}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="structured">Structured branded template</SelectItem><SelectItem value="advanced_html">Advanced sanitized HTML</SelectItem></SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">Advanced HTML removes scripts, styles, media, forms, event handlers, and unsafe links.</p></div>
          <div><Label>Subject</Label><Input className="mt-1.5" value={draft.subject} onChange={(event) => updateDraft('subject', event.target.value)} /></div>
          <div><Label>Preheader</Label><Input className="mt-1.5" value={draft.preheader} onChange={(event) => updateDraft('preheader', event.target.value)} /></div>
          {draft.mode === 'structured' ? <div className="space-y-4"><div><Label>Heading</Label><Input className="mt-1.5" value={draft.heading} onChange={(event) => updateDraft('heading', event.target.value)} /></div><div><Label>Body</Label><Textarea className="mt-1.5 min-h-36" value={draft.bodyText} onChange={(event) => updateDraft('bodyText', event.target.value)} /></div><div className="grid md:grid-cols-2 gap-4"><div><Label>Button label</Label><Input className="mt-1.5" value={draft.ctaLabel} onChange={(event) => updateDraft('ctaLabel', event.target.value)} /></div><div><Label>Button URL</Label><Input className="mt-1.5 font-mono text-sm" value={draft.ctaUrlTemplate} onChange={(event) => updateDraft('ctaUrlTemplate', event.target.value)} /></div></div></div> : <div className="space-y-4"><div><Label>HTML</Label><Textarea className="mt-1.5 min-h-64 font-mono text-xs" value={draft.advancedHtml} onChange={(event) => updateDraft('advancedHtml', event.target.value)} placeholder="<p>Your email content</p>" /></div><div><Label>Plain-text fallback</Label><Textarea className="mt-1.5 min-h-32 font-mono text-xs" value={draft.advancedText} onChange={(event) => updateDraft('advancedText', event.target.value)} /></div></div>}
          <div><Label>Available variables</Label><div className="mt-2 flex flex-wrap gap-1.5">{selected.allowedVariables.map((variable) => <code key={variable} className="border bg-muted px-2 py-1 text-xs">{`{{${variable}}}`}</code>)}</div></div>
          <div className="flex flex-wrap gap-2 border-t pt-5"><Button onClick={saveTemplate} disabled={!!templateBusy || !dirty}>{templateBusy === 'save' ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Save template</Button><Button variant="outline" onClick={renderPreview} disabled={!!templateBusy}>{templateBusy === 'preview' ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}Preview</Button></div>
          {preview && <div className="space-y-2"><p className="text-sm"><span className="text-muted-foreground">Subject:</span> {preview.subject}</p><iframe title={`${selected.name} preview`} sandbox="" srcDoc={preview.html} className="h-[520px] w-full border bg-white" /><details><summary className="cursor-pointer text-sm text-muted-foreground">Plain-text preview</summary><pre className="mt-2 whitespace-pre-wrap border bg-muted p-3 text-xs">{preview.text}</pre></details></div>}
          <div className="border-t pt-5 space-y-3"><div><Label>Test recipient</Label><div className="mt-1.5 flex gap-2"><Input type="email" value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} /><Button variant="outline" onClick={sendTest} disabled={!!templateBusy || dirty || !draft.enabled || !testRecipient}>{templateBusy === 'test' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Send test</Button></div><p className="mt-1 text-xs text-muted-foreground">Tests can only go to your signed-in address or the configured admin email. Save changes first.</p></div></div>
        </div>}
      </div>}
    </section>

    <CampaignsPanel adminEmail={adminEmail} />
  </div>;
}
