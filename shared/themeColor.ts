export function hexToHsl(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const n = parseInt(match[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), l = (max+min)/2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max-min;
    s = l > .5 ? d/(2-max-min) : d/(max+min);
    h = max === r ? (g-b)/d+(g<b?6:0) : max === g ? (b-r)/d+2 : (r-g)/d+4;
    h *= 60;
  }
  return [Math.round(h),Math.round(s*100),Math.round(l*100)];
}
/** Pick the higher WCAG contrast, including saturated custom brand colors. */
export function readableForeground(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return '0 0% 100%';
  const channels = [0,2,4].map((start) => parseInt(match[1].slice(start,start+2),16)/255).map((v) => v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  const luminance = channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
  return (luminance+.05)/.05 >= 1.05/(luminance+.05) ? '0 0% 0%' : '0 0% 100%';
}

/** Palette-only edition. Neutral warm charcoal and paper text; categories supply the color. */
export const coloredBlackTokens: Record<string, string> = {
  '--background': '60 3% 7%', '--foreground': '50 10% 83%',
  '--card': '60 6% 11%', '--card-foreground': '50 10% 83%',
  '--popover': '60 5% 12%', '--popover-foreground': '50 10% 83%',
  '--primary': '50 10% 83%', '--primary-foreground': '60 3% 7%',
  '--accent': '60 5% 19%', '--accent-foreground': '50 10% 87%',
  '--secondary': '60 5% 15%', '--secondary-foreground': '50 10% 83%',
  '--muted': '60 5% 14%', '--muted-foreground': '45 5% 63%',
  '--border': '60 4% 21%', '--input': '60 4% 40%', '--ring': '50 10% 74%',
  '--grey': '45 5% 63%', '--grey-2': '45 5% 57%',
  '--destructive': '0 78% 68%', '--destructive-foreground': '60 3% 7%',
  '--sidebar-background': '60 3% 7%', '--sidebar-foreground': '50 10% 83%',
  '--sidebar-border': '60 4% 21%',
};
