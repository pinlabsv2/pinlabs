import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Motif, SeasonalScene } from './SeasonalArt';
import { useSeason, useSeasonClock } from './SeasonProvider';
import { seasonLabels } from '@/shared/seasons';
import { Button } from '@/ui-kit/ui/button';

export function SeasonalHero() {
  const { season, config, design } = useSeason();
  if (!design) return null;
  return <section className="season-hero border-b">
    <div className="container mx-auto px-4 py-10 md:py-16 grid md:grid-cols-2 gap-6 items-center">
      <div className="season-hero-copy">
        <p className="season-eyebrow"><span className="season-index">{seasonLabels[season]}</span> / {design.eyebrow}</p>
        <h1 className="season-headline">{config.themeHeadline || design.headline}</h1>
        <p className="season-description">{config.themeSubtitle || design.subtitle}</p>
        <div className="mt-6 flex flex-wrap items-center gap-4"><Button asChild><a href="#catalog">Explore the collection <span aria-hidden="true">↗</span></a></Button><span className="text-xs font-mono text-muted-foreground">Laboratory research only</span></div>
        <p className="season-caption">{design.caption}</p>
      </div>
      <SeasonalScene season={season} motif={design.motif}/>
    </div>
    <div className="season-editorial-strip"><span>{config.storeName}</span><Motif kind={design.motif}/><span>research collection</span><Motif kind={design.motif}/><span>{design.eyebrow}</span></div>
  </section>;
}
export function SeasonalAnnouncement() {
  const { design, config } = useSeason();
  const now = useSeasonClock();
  if (!design) return null;
  const remaining = config.themeCountdownAt ? Math.max(0, Date.parse(config.themeCountdownAt)-now) : 0;
  const seconds = Math.floor(remaining/1000);
  const countdown = `${Math.floor(seconds/86400)}d ${String(Math.floor(seconds/3600)%24).padStart(2,'0')}h ${String(Math.floor(seconds/60)%60).padStart(2,'0')}m ${String(seconds%60).padStart(2,'0')}s`;
  return <div className="season-announcement"><Motif kind={design.motif}/><span>{config.themeAnnouncement || design.announcement}</span>{remaining>0 && <span role="timer" aria-label={`Event countdown: ${countdown}`} className="season-countdown">{countdown}</span>}</div>;
}
export function SeasonalNavDecor() {
  const { design, season, motion } = useSeason();
  const [lit, setLit] = useState(false);
  if (!design) return null;
  return <div className={`season-nav-decor ${lit ? 'is-lit' : ''}`}>
    {['spring','christmas','easter'].includes(season) && <svg className="season-vine" viewBox="0 0 1200 24" preserveAspectRatio="none" aria-hidden="true"><path d="M0 1q75 40 150 0t150 0 150 0 150 0 150 0 150 0 150 0 150 0" fill="none" stroke="currentColor"/></svg>}
    {season === 'halloween' && <svg className="season-web" viewBox="0 0 100 60" aria-hidden="true"><path d="M0 0 100 60M0 0l90 20M0 0l35 60M30 0q-10 20-30 20M65 0Q50 45 0 40M95 0Q80 70 0 60" fill="none" stroke="currentColor"/></svg>}
    <div className="season-garland" aria-hidden="true">{Array.from({length:12},(_,i)=><span key={i}><Motif kind={design.motif}/></span>)}</div>
    <button type="button" className="season-interactive-motif" aria-pressed={lit} aria-label={`${lit ? 'Reset' : 'Illuminate'} ${seasonLabels[season]} decoration`} onClick={() => setLit(!lit)} title="Tap for a seasonal detail"><Motif kind={design.motif}/></button>
    <span className="sr-only">{lit ? 'Seasonal decoration illuminated.' : 'Seasonal decoration in its original state.'}{!motion ? ' Motion is off.' : ''}</span>
  </div>;
}
export function SeasonalCardDecoration() {
  const { design, season } = useSeason();
  return design ? <div className={`season-card-decoration season-card-decoration--${season}`} aria-hidden="true"><Motif kind={design.motif}/></div> : null;
}
export function SeasonalDivider() {
  const { design } = useSeason();
  return design ? <div className="season-section-rule" aria-hidden="true"><span/><Motif kind={design.motif}/><span/></div> : null;
}
export function SeasonalEmpty({ kind = 'cart' }: { kind?: 'cart' | 'search' }) {
  const { design, season } = useSeason();
  if (!design) return null;
  return <div className="season-empty" aria-hidden="true"><svg viewBox="0 0 180 140" fill="none"><path d="M38 50h104l-9 76H47ZM65 50V34a25 25 0 0 1 50 0v16" stroke="currentColor" strokeWidth="2"/><path d="M10 130h160M20 40l9 4m128-15-7 6M30 14l5 8" stroke="currentColor" strokeOpacity=".4"/>{kind === 'search' && <circle cx="90" cy="90" r="26" stroke="currentColor" strokeDasharray="3 4"/>}</svg><Motif kind={design.motif} className={`season-empty-motif season-empty-motif--${season}`}/></div>;
}
export function SeasonalMotionControl() {
  const { design, motion, reduced, visitorMotion, setVisitorMotion, config } = useSeason();
  if (!design) return null;
  return <div className="season-motion-control"><button type="button" onClick={() => setVisitorMotion(!visitorMotion)} aria-pressed={visitorMotion} className="underline underline-offset-4">{visitorMotion ? 'Turn seasonal motion off' : 'Turn seasonal motion on'}</button><span> · {motion ? 'ambient motion on' : 'motion off'}{!config.themeMotion ? ' by the store' : reduced ? ' by your device preference' : ''}</span></div>;
}
export function SeasonalCheckoutAccent() {
  const { design } = useSeason();
  return design ? <div className="season-checkout-note"><Motif kind={design.motif}/><p>A little seasonal detail. The same secure order process.<br/><Link to="/policies/shipping" className="underline">View shipping information</Link></p></div> : null;
}
