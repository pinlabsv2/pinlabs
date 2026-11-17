/** Spectrum accents from the Colored Black reference; never used as text colors. */
export const categoryPalette = ['#1EC474', '#FF7F16', '#F83C86', '#2266F4', '#E5DD19', '#9151E9'] as const;
export const validCategoryColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export function categoryColor(value: unknown, index = 0): string {
  return validCategoryColor(value) ? value.toUpperCase() : categoryPalette[Math.abs(index) % categoryPalette.length];
}
