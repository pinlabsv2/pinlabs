import { hexToHsl, readableForeground } from '../../../shared/themeColor';
import { useEffect } from 'react';
import { useSeason } from './seasonal/SeasonProvider';
import { MotifScatter } from './seasonal/SeasonalArt';
import { SeasonalAnnouncement } from './seasonal/SeasonalExperience';

export default function ThemeColors() {
  const { season, design, config, motion } = useSeason();
  useEffect(() => {
    const root = document.documentElement;
    const previous = new Map<string, string>();
    const previousSeason = root.getAttribute('data-season');
    const previousIntensity = root.getAttribute('data-season-intensity');
    const previousMotion = root.getAttribute('data-season-motion');
    root.setAttribute('data-season', season);
    root.setAttribute('data-season-intensity', config.themeIntensity);
    root.setAttribute('data-season-motion', motion ? 'on' : 'off');
    const set = (key: string, value: string) => {
      if (!previous.has(key)) previous.set(key, root.style.getPropertyValue(key));
      root.style.setProperty(key, value);
    };
    if (design) {
      set('--background', design.paper); set('--card', design.card); set('--popover', design.card);
      for (const key of ['--foreground','--card-foreground','--popover-foreground','--secondary-foreground']) set(key, design.ink);
      set('--muted-foreground', design.muted); set('--grey', design.muted);
      set('--muted', design.paper); set('--secondary', design.paper);
      set('--border', design.border); set('--input', design.border);
    }
    const p = hexToHsl(config.primary), a = hexToHsl(config.accent);
    const primary = p ? `${p[0]} ${p[1]}% ${p[2]}%` : design?.primary;
    const accent = a ? `${a[0]} ${a[1]}% ${a[2]}%` : design?.accent;
    if (primary) {
      for (const key of ['--primary','--ring','--sidebar-primary','--sidebar-ring','--chart-1']) set(key, primary);
      for (const key of ['--primary-foreground','--sidebar-primary-foreground']) set(key, p ? readableForeground(config.primary) : '0 0% 100%');
    }
    if (accent) {
      for (const key of ['--accent','--sidebar-accent','--chart-2','--promo']) set(key, accent);
      for (const key of ['--accent-foreground','--sidebar-accent-foreground','--promo-foreground']) set(key, a ? readableForeground(config.accent) : '0 0% 100%');
    }
    return () => {
      previous.forEach((value,key)=>value ? root.style.setProperty(key,value) : root.style.removeProperty(key));
      for (const [key, value] of [['data-season',previousSeason],['data-season-intensity',previousIntensity],['data-season-motion',previousMotion]]) {
        if (value == null) root.removeAttribute(key!); else root.setAttribute(key!,value);
      }
    };
  }, [season, design, config.primary, config.accent, config.themeIntensity, motion]);
  return <>{design && motion && <MotifScatter motif={design.motif} count={config.themeIntensity === 'subtle' ? 6 : config.themeIntensity === 'celebration' ? 26 : 14}/>}<SeasonalAnnouncement/></>;
}
