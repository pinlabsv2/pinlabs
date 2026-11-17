import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { manageCategories, type ManageSettingsOutputType } from '@/lib/api';
import { Button } from '@/ui-kit/ui/button';
type BrandSettings = Extract<ManageSettingsOutputType, { section: 'brand' }>['settings'];
export default function SeasonPreviewFrame({ settings }: { settings: BrandSettings }) {
  const { data: categories } = useQuery({queryKey:['categories'],queryFn:()=>manageCategories({action:'list'})});
  const frame = useRef<HTMLIFrameElement>(null);
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const send = useCallback(() => frame.current?.contentWindow?.postMessage({ type: 'pinlabs-theme-preview', config: { ...settings, categoryColors: categories?.categories.map(({name,color})=>({name,color})), primary: settings.primaryColor, accent: settings.accentColor } }, window.location.origin), [settings,categories]);
  useEffect(() => {
    send();
    const ready = (event: MessageEvent) => { if (event.origin === window.location.origin && event.source === frame.current?.contentWindow && event.data?.type === 'pinlabs-theme-preview-ready') send(); };
    window.addEventListener('message', ready);
    return () => window.removeEventListener('message', ready);
  }, [send]);
  return <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-medium">live theme preview</h2><div className="flex gap-2">{(['desktop','mobile'] as const).map((mode)=><Button key={mode} variant={viewport===mode?'default':'outline'} size="sm" aria-pressed={viewport===mode} onClick={()=>setViewport(mode)}>{mode}</Button>)}</div></div>
    <p className="text-xs text-muted-foreground">Draft appearance updates immediately. Desktop is 1000px; mobile is 390px. Preview ignores the publish window and cannot place orders. Save to publish.</p>
    <div className="border overflow-auto bg-muted p-2"><iframe ref={frame} src="/theme-preview" title="Live seasonal storefront preview" onLoad={send} className="border-0 bg-background mx-auto block" style={{ width: viewport==='mobile'?390:1000, height:850, maxWidth:'none' }}/></div>
  </section>;
}
