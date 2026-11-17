import { useId, type CSSProperties } from 'react';
import type { Season } from '@/shared/seasons';

/** Small original vector motifs; no external image, font or animation requests. */
export function Motif({ kind, className = '' }: { kind: string; className?: string }) {
  return <svg className={className} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    {kind === 'snowflake' ? <><path d="M20 3v34M5 11l30 18M5 29l30-18M15 7l5 5 5-5M15 33l5-5 5 5M6 17l7-1-1-7M34 23l-7 1 1 7M6 23l7 1-1 7M34 17l-7-1 1-7" /></>
      : kind === 'sun' ? <><circle cx="20" cy="20" r="9" /><path d="M20 1v6m0 26v6M1 20h6m26 0h6M6 6l5 5m18 18 5 5M6 34l5-5M29 11l5-5" /></>
      : kind === 'leaf' ? <><path d="M33 5C5 3 3 24 14 30 28 38 37 21 33 5ZM5 37 29 11m-14 4v12m1-1h11" /></>
      : kind === 'flower' ? <><path d="M20 15C5-4 0 17 15 20-4 35 17 40 20 25c15 19 20-2 5-5C44 5 23 0 20 15Z" /><circle cx="20" cy="20" r="4" /></>
      : kind === 'pumpkin' ? <><path d="M20 11c-19-9-24 25-5 24h10c19 1 14-33-5-24Zm0 0c-7 3-7 21 0 24 7-3 7-21 0-24Zm0-1c-2-6 1-8 5-9" /><path d="m10 22 4-4 3 5m6 0 3-5 4 4M13 28l7 3 7-3" /></>
      : kind === 'ornament' ? <><circle cx="20" cy="25" r="12" /><path d="M16 13V7h8v6M20 7V0M10 20l20 10M9 26l17 9" /></>
      : kind === 'heart' ? <path d="M20 35 5 20C-7 5 15-4 20 10c5-14 27-5 15 10Z" />
      : kind === 'egg' ? <><path d="M20 3C8 3-3 36 20 37 43 36 32 3 20 3Z" /><path d="m8 22 6-4 6 4 6-4 6 4M8 29h24M15 11h10" /></>
      : kind === 'ticket' ? <><path d="M3 8h34v9a4 4 0 0 0 0 8v9H3v-9a4 4 0 0 0 0-8Z" /><path d="M27 9v24M10 15h10m-10 6h7m-7 6h10" strokeDasharray="2 2" /></>
      : kind === 'ribbon' ? <><circle cx="20" cy="16" r="12" /><path d="m11 24-4 13 9-4 4 6 4-6 9 4-4-13M20 8l2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1Z" /></>
      : <><path d="M20 2v10m0 16v10M2 20h10m16 0h10M7 7l7 7m12 12 7 7M7 33l7-7m12-12 7-7" /><circle cx="20" cy="20" r="4" /></>}
  </svg>;
}

export function SeasonalScene({ season, motif }: { season: Season; motif: string }) {
  const id = useId().replaceAll(':', '');
  const winter = season === 'winter' || season === 'christmas';
  const botanical = ['spring','fall','easter'].includes(season);
  return <div className={`season-scene season-scene--${season}`} aria-hidden="true">
    <svg className="scene-landscape" viewBox="0 0 600 380" fill="none">
      <defs><linearGradient id={`${id}-sky`} x2="0" y2="1"><stop stopColor="currentColor" stopOpacity=".1"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient><pattern id={`${id}-grid`} width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0v30" stroke="currentColor" strokeOpacity=".08" /></pattern></defs>
      <path d="M0 0h600v380H0z" fill={`url(#${id}-sky)`}/><path d="M0 0h600v380H0z" fill={`url(#${id}-grid)`}/>
      <circle className="scene-orbit" cx="300" cy="180" r="140" stroke="currentColor" strokeOpacity=".2" strokeDasharray="3 8"/>
      <circle className="scene-sun" cx={season === 'halloween' ? 420 : 440} cy="92" r="48" fill="currentColor" opacity=".2"/>
      {winter && <><path d="m0 315 135-190 126 161L365 122l235 236H0Z" fill="currentColor" opacity=".14"/><path d="m94 183 41-58 44 57-26-10-17 15-18-13Zm230 3 41-64 63 64-32-11-27 18-22-20Z" fill="var(--scene-snow,white)"/><path d="M0 338q160-45 300-10t300 6v46H0Z" fill="currentColor" opacity=".08"/></>}
      {season === 'summer' && <><path d="M0 275q75-40 150 0t150 0 150 0 150 0v105H0Z" fill="currentColor" opacity=".1"/><path className="scene-waves" d="M-100 305q75-35 150 0t150 0 150 0 150 0 150 0M-100 335q75-35 150 0t150 0 150 0 150 0 150 0" stroke="currentColor" strokeOpacity=".35"/><path d="M40 380q70-145 170-90t170 90" fill="currentColor" opacity=".08"/></>}
      {botanical && <><path d="M0 340q150-95 300-10t300-10v60H0Z" fill="currentColor" opacity=".1"/>{[75,170,420,510].map((x,i) => <g key={x} transform={`translate(${x} ${200+i%2*35})`}><path d="M0 150V0m0 75-35-30m35-5 30-30" stroke="currentColor" strokeOpacity=".45"/>{season === 'fall' ? <path d="M0-55C-90 0-60 85 0 65 75 85 90-5 0-55Z" fill="currentColor" opacity=".16"/> : <><circle cx="0" cy="-10" r="25" fill="currentColor" opacity=".12"/><circle cx="-20" cy="15" r="22" fill="currentColor" opacity=".1"/><circle cx="20" cy="15" r="22" fill="currentColor" opacity=".1"/></>}</g>)}</>}
      {season === 'halloween' && <><path d="M100 330V180h50v-55h25v55h70v150m-160 0h190M108 180l52-65 65 65M140 330v-65h40v65m-60-105h25v25h-25m65-25h25v25h-25M385 165q14-28 28 0 14-28 28 0-28-10-28 15-1-25-28-15Z" fill="currentColor" opacity=".35"/><path d="M275 325v-100h-15v-17h45v17h-15v100m-15-40h15" stroke="currentColor" strokeWidth="4" opacity=".4"/><path className="scene-fog" d="M0 345q100-40 200 0t200 0 200 0" stroke="currentColor" strokeWidth="18" strokeOpacity=".1"/></>}
      {season === 'christmas' && <><path d="m430 135-55 80h25l-45 65h42l-40 55h145l-40-55h40l-45-65h27Zm-7 200v25h14v-25" fill="currentColor" opacity=".36"/>{[200,235,270,300].map((y,i)=><circle key={y} cx={420+i%2*20} cy={y} r="5" fill="hsl(var(--accent))"/>)}</>}
      {['new-year','anniversary'].includes(season) && <><path d="M60 350V250h35v100h25V220h45v130h20V270h45v80h25V200h45v150h25V235h45v115h25V265h45v85h25V230h50v120h25V285h40v65" stroke="currentColor" opacity=".28"/>{[140,300,460].map((x,i)=><g className="scene-firework" key={x} style={{animationDelay:`${i*1.7}s`}} transform={`translate(${x} ${80+i%2*55})`}>{Array.from({length:8},(_,j)=><path key={j} d="M0-18V-45" transform={`rotate(${j*45})`} stroke="currentColor" opacity=".55"/>)}</g>)}</>}
      {season === 'black-friday' && <><path d="m65 100 150-20 85 150-150 20Zm260 35 165 10-10 135-165-10Z" stroke="currentColor" strokeWidth="2" strokeDasharray="5 5"/><path d="m75 290 450-150M75 310l450-150" stroke="currentColor" opacity=".15"/><text x="130" y="175" fontFamily="monospace" fontSize="38" fill="currentColor" transform="rotate(-7 130 175)">EDITION</text></>}
      {season === 'valentines' && <><path d="M300 285 190 175c-75-85 55-145 110-65 55-80 185-20 110 65Z" fill="currentColor" opacity=".12"/><path d="M160 310h280M200 310v-70m200 70v-70" stroke="currentColor" opacity=".25"/></>}
      <path d="M20 360h560M20 355v10m560-10v10" stroke="currentColor" strokeOpacity=".25"/>
    </svg>
    <div className="scene-motif"><Motif kind={motif}/></div>
    <span className="scene-coordinate">FIELD NOTES / {String(['summer','winter','fall','spring','halloween','black-friday','christmas','new-year','valentines','easter','anniversary'].indexOf(season)+1).padStart(2,'0')}</span>
  </div>;
}
export function MotifScatter({ motif, count }: { motif: string; count: number }) {
  return <div className="seasonal-ambience" aria-hidden="true">{Array.from({length:count},(_,i)=><span key={i} style={{left:`${(i*37+7)%100}%`,animationDelay:`${-i*1.7}s`,animationDuration:`${12+i%9}s`,width:`${12+i%4*5}px`} as CSSProperties}><Motif kind={motif}/></span>)}</div>;
}
