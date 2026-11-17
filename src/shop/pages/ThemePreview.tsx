import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, ShoppingBag } from 'lucide-react';
import { seasons, seasonLabels, seasonalDefaults, type SeasonalConfig } from '@/shared/seasons';
import ThemeColors from '../components/ThemeColors';
import { SeasonProvider } from '../components/seasonal/SeasonProvider';
import { SeasonalHero, SeasonalNavDecor, SeasonalDivider, SeasonalCardDecoration, SeasonalEmpty, SeasonalCheckoutAccent, SeasonalMotionControl } from '../components/seasonal/SeasonalExperience';

type Draft = SeasonalConfig & { primary: string; accent: string; storeName: string };
const initial: Draft = { ...seasonalDefaults, primary: '', accent: '', storeName: 'PinLabs' };
export default function ThemePreview() {
  const [draft, setDraft] = useState<Draft>(initial);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== 'pinlabs-theme-preview') return;
      const value = event.data.config;
      if (!value || !seasons.includes(value.seasonalTheme)) return;
      const safe = { ...initial, seasonalTheme: value.seasonalTheme };
      for (const key of ['themeHeadline','themeSubtitle','themeAnnouncement','themeCountdownAt','primary','accent','storeName'] as const) {
        if (typeof value[key] === 'string') safe[key] = value[key].slice(0, 500);
      }
      if (['subtle','balanced','celebration'].includes(value.themeIntensity)) safe.themeIntensity = value.themeIntensity;
      safe.themeMotion = value.themeMotion !== false;
      // Deliberately preview the selected design independently of its publish window.
      setDraft(safe);
    };
    window.addEventListener('message', receive);
    if (window.parent !== window) window.parent.postMessage({ type: 'pinlabs-theme-preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', receive);
  }, []);
  return <SeasonProvider override={draft}><div className="storefront min-h-screen" onClickCapture={(event) => { if ((event.target as HTMLElement).closest('a')) event.preventDefault(); }}>
    {window.parent === window && <div className="border-b p-3 flex flex-wrap items-center gap-3 text-sm"><label htmlFor="preview-theme">Preview theme</label><select id="preview-theme" className="border bg-background p-2" value={draft.seasonalTheme} onChange={(e)=>setDraft((current)=>({...current,seasonalTheme:e.target.value as Draft['seasonalTheme']}))}>{seasons.map((theme)=><option key={theme} value={theme}>{seasonLabels[theme]}</option>)}</select><p className="text-xs text-muted-foreground">Read-only design preview. Nothing here changes the store.</p></div>}
    <ThemeColors/>
    <header className="bg-background border-b"><SeasonalNavDecor/><div className="flex h-16 items-center gap-3 px-4"><FlaskConical className="text-primary"/><strong>{draft.storeName}</strong><span className="ml-auto text-xs text-muted-foreground">Preview only</span><ShoppingBag className="size-5"/></div></header>
    {draft.seasonalTheme === 'default' ? <section className="p-8 border-b"><p className="font-mono text-xs">LABORATORY RESEARCH COLLECTION</p><h1 className="text-4xl mt-4">Lab-verified peptides,<br/>shipped discreetly.</h1></section> : <SeasonalHero/>}
    <main id="catalog" className="p-5 space-y-6">
      <SeasonalDivider/><div className="flex items-center gap-3"><span className="size-2.5 bg-foreground"/><h2 className="text-xl">research collection</h2><span className="h-px bg-border flex-1"/></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{['Reference material','Laboratory collection','Research supplies'].map((name,index)=><article key={name} className="season-product-card group border bg-card flex flex-col">
        <div className="season-product-image relative grid place-items-center aspect-[4/3] bg-muted"><FlaskConical className="size-12 text-primary/40"/><SeasonalCardDecoration/></div><div className="p-4 space-y-3"><p className="text-[10px] font-mono text-muted-foreground">ILLUSTRATIVE PRODUCT / 0{index+1}</p><h3 className="font-semibold">{name}</h3><p className="text-xs text-muted-foreground">Ships from your selected origin</p><div className="flex justify-between items-center"><span className="font-mono">$—</span><button className="bg-primary text-primary-foreground px-3 py-2 text-xs" type="button">Preview action</button></div></div>
      </article>)}</div>
      <section className="border p-5 text-center"><SeasonalEmpty/><p>Your empty cart illustration</p></section><SeasonalCheckoutAccent/>
    </main><footer className="border-t p-6 text-center space-y-3 text-xs text-muted-foreground"><SeasonalMotionControl/><p>{draft.storeName} · Laboratory research only</p><Link to="/policies/terms">Policies preview</Link></footer>
  </div></SeasonProvider>;
}
