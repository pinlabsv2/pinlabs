import { useEffect } from 'react';
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

/** Applies the admin-chosen main + accent colors over the default theme. */
export default function ThemeColors() {
  const { data } = useStorefront();
  useEffect(() => {
    const root = document.documentElement.style;
    const p = hexToHsl(data?.theme.primary ?? '');
    const a = hexToHsl(data?.theme.accent ?? '');
    for (const k of ['--primary', '--ring', '--sidebar-primary', '--sidebar-ring', '--chart-1', '--primary-foreground', '--sidebar-primary-foreground', '--accent', '--sidebar-accent', '--chart-2', '--accent-foreground', '--sidebar-accent-foreground']) root.removeProperty(k);
    if (p) {
      const v = `${p[0]} ${p[1]}% ${p[2]}%`;
      for (const k of ['--primary', '--ring', '--sidebar-primary', '--sidebar-ring', '--chart-1']) root.setProperty(k, v);
      root.setProperty('--primary-foreground', fg(p[2]));
      root.setProperty('--sidebar-primary-foreground', fg(p[2]));
    }
    if (a) {
      const v = `${a[0]} ${a[1]}% ${a[2]}%`;
      for (const k of ['--accent', '--sidebar-accent', '--chart-2']) root.setProperty(k, v);
      root.setProperty('--accent-foreground', fg(a[2]));
      root.setProperty('--sidebar-accent-foreground', fg(a[2]));
    }
  }, [data?.theme.primary, data?.theme.accent]);
  return null;
}
