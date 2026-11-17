import { useEffect, type CSSProperties } from 'react';
import { seasonLabels, type Season } from '@/shared/seasons';
import { useStorefront } from '../lib/store';

function hexToHsl(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

const fg = (l: number) => (l > 55 ? '0 0% 4%' : '0 0% 100%');

// HSL tokens match the site's existing semantic design system.
const palettes: Record<string, { primary: string; accent: string; paper: string; glyph: string }> = {
  summer: { primary: '24 85% 35%', accent: '175 55% 31%', paper: '48 100% 97%', glyph: '☀' },
  winter: { primary: '211 68% 35%', accent: '195 55% 39%', paper: '210 70% 98%', glyph: '❄' },
  fall: { primary: '22 72% 32%', accent: '38 65% 35%', paper: '34 60% 96%', glyph: '🍂' },
  spring: { primary: '143 48% 28%', accent: '330 45% 40%', paper: '100 45% 97%', glyph: '✿' },
  halloween: { primary: '26 85% 39%', accent: '275 48% 35%', paper: '30 45% 95%', glyph: '🎃' },
  'black-friday': { primary: '0 0% 8%', accent: '42 78% 33%', paper: '0 0% 94%', glyph: '✦' },
  christmas: { primary: '150 65% 24%', accent: '354 65% 35%', paper: '145 30% 97%', glyph: '❄' },
  'new-year': { primary: '248 42% 30%', accent: '42 75% 32%', paper: '45 55% 97%', glyph: '✧' },
  valentines: { primary: '340 64% 36%', accent: '320 40% 38%', paper: '340 65% 97%', glyph: '♡' },
  easter: { primary: '270 42% 38%', accent: '145 45% 28%', paper: '55 65% 97%', glyph: '✿' },
};

export default function ThemeColors() {
  const { data } = useStorefront();
  const season = data?.theme.seasonal ?? 'default';
  const palette = palettes[season];
  useEffect(() => {
    const root = document.documentElement.style;
    const previous = new Map<string, string>();
    const set = (key: string, value: string) => {
      if (!previous.has(key)) previous.set(key, root.getPropertyValue(key));
      root.setProperty(key, value);
    };
    if (palette) {
      for (const key of ['--background', '--card', '--popover']) set(key, palette.paper);
      set('--foreground', '220 22% 12%');
      set('--card-foreground', '220 22% 12%');
      set('--popover-foreground', '220 22% 12%');
      set('--muted', '210 18% 92%');
      set('--muted-foreground', '220 12% 34%');
      set('--border', '215 18% 78%');
      set('--input', '215 18% 78%');
    }
    const p = hexToHsl(data?.theme.primary ?? '');
    const a = hexToHsl(data?.theme.accent ?? '');
    const primary = p ? `${p[0]} ${p[1]}% ${p[2]}%` : palette?.primary;
    const accent = a ? `${a[0]} ${a[1]}% ${a[2]}%` : palette?.accent;
    if (primary) {
      for (const key of ['--primary','--ring','--sidebar-primary','--sidebar-ring','--chart-1']) set(key, primary);
      for (const key of ['--primary-foreground','--sidebar-primary-foreground']) set(key, p ? fg(p[2]) : '0 0% 100%');
    }
    if (accent) {
      for (const key of ['--accent','--sidebar-accent','--chart-2','--promo']) set(key, accent);
      for (const key of ['--accent-foreground','--sidebar-accent-foreground','--promo-foreground']) set(key, a ? fg(a[2]) : '0 0% 100%');
    }
    return () => previous.forEach((value, key) => value ? root.setProperty(key, value) : root.removeProperty(key));
  }, [palette, data?.theme.primary, data?.theme.accent]);
  if (!palette) return null;
  return <>
    <div className="seasonal-ambience" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <span key={`${season}-${i}`} style={{ left: `${(i * 37 + 7) % 100}%`, animationDelay: `${-i * 1.7}s`, animationDuration: `${12 + i % 9}s`, fontSize: `${12 + i % 4 * 5}px` } as CSSProperties}>{palette.glyph}</span>)}</div>
    <div className="border-b bg-accent text-accent-foreground px-4 py-1 text-center text-xs tracking-widest">{seasonLabels[season as Season] ?? season} · laboratory research only</div>
  </>;
}
