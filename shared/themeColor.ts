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
