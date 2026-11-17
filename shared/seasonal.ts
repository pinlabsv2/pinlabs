/** Pure shared configuration: safe in both the API and browser. */
export const seasons = ['default', 'summer', 'winter', 'fall', 'spring', 'halloween', 'black-friday', 'christmas', 'new-year', 'valentines', 'easter', 'anniversary'] as const;
export type Season = typeof seasons[number];
export const seasonLabels: Record<Season, string> = { default: 'Original', summer: 'Summer', winter: 'Winter', fall: 'Fall', spring: 'Spring', halloween: 'Halloween', 'black-friday': 'Black Friday', christmas: 'Christmas', 'new-year': 'New Year', valentines: 'Valentine’s Day', easter: 'Easter', anniversary: 'Store anniversary' };
export const intensities = ['subtle', 'balanced', 'celebration'] as const;
export type Intensity = typeof intensities[number];
export type SeasonalConfig = {
  seasonalTheme: Season; themeIntensity: Intensity; themeMotion: boolean;
  themeHeadline: string; themeSubtitle: string; themeAnnouncement: string;
  themeStartsAt: string; themeEndsAt: string; themeCountdownAt: string;
};
export const seasonalDefaults: SeasonalConfig = {
  seasonalTheme: 'default', themeIntensity: 'balanced', themeMotion: true,
  themeHeadline: '', themeSubtitle: '', themeAnnouncement: '', themeStartsAt: '', themeEndsAt: '', themeCountdownAt: '',
};
export function activeSeason(config: Pick<SeasonalConfig, 'seasonalTheme' | 'themeStartsAt' | 'themeEndsAt'>, now: number): Season {
  if (!seasons.includes(config.seasonalTheme)) return 'default';
  const start = config.themeStartsAt ? Date.parse(config.themeStartsAt) : null;
  const end = config.themeEndsAt ? Date.parse(config.themeEndsAt) : null;
  if (start !== null && (!Number.isFinite(start) || now < start)) return 'default';
  if (end !== null && (!Number.isFinite(end) || now >= end)) return 'default';
  return config.seasonalTheme;
}
export type SeasonDesign = {
  primary: string; accent: string; paper: string; card: string; ink: string; muted: string; border: string;
  glyph: string; motif: string; eyebrow: string; headline: string; subtitle: string; announcement: string; caption: string;
};
export const designs: Record<Exclude<Season, 'default'>, SeasonDesign> = {
  summer: { primary: '23 85% 33%', accent: '174 68% 26%', paper: '46 100% 97%', card: '45 90% 99%', ink: '180 45% 12%', muted: '175 18% 32%', border: '40 45% 75%', glyph: '✺', motif: 'sun', eyebrow: 'the summer collection', headline: 'a brighter season\nfor discovery.', subtitle: 'A new perspective, the same research standards. Explore the laboratory collection in full summer colour.', announcement: 'Summer at the lab', caption: 'sunlit horizons · precise research' },
  winter: { primary: '213 74% 33%', accent: '192 73% 25%', paper: '210 65% 97%', card: '210 80% 99%', ink: '215 45% 14%', muted: '214 22% 34%', border: '210 35% 77%', glyph: '❄', motif: 'snowflake', eyebrow: 'the winter collection', headline: 'clear thinking.\nnew horizons.', subtitle: 'A quiet season for focused research. Discover the collection beneath an alpine sky.', announcement: 'Winter research collection', caption: 'alpine skies · fresh perspectives' },
  fall: { primary: '20 74% 31%', accent: '40 71% 28%', paper: '35 65% 95%', card: '38 75% 98%', ink: '23 40% 14%', muted: '26 20% 32%', border: '29 35% 72%', glyph: '❧', motif: 'leaf', eyebrow: 'the autumn collection', headline: 'a new chapter\nin the making.', subtitle: 'Warm copper, crisp mornings, and room for your next research question.', announcement: 'A new season of discovery', caption: 'copper leaves · considered research' },
  spring: { primary: '149 55% 25%', accent: '330 48% 37%', paper: '103 45% 97%', card: '105 50% 99%', ink: '145 35% 13%', muted: '145 18% 32%', border: '130 24% 74%', glyph: '✿', motif: 'flower', eyebrow: 'the spring collection', headline: 'let new ideas\ntake root.', subtitle: 'A fresh palette for a fresh perspective. Make space for the next chapter of laboratory research.', announcement: 'Fresh perspectives for spring', caption: 'botanical details · new beginnings' },
  halloween: { primary: '27 92% 36%', accent: '278 48% 34%', paper: '35 50% 95%', card: '37 65% 98%', ink: '267 33% 13%', muted: '266 17% 34%', border: '275 20% 72%', glyph: '✦', motif: 'pumpkin', eyebrow: 'after hours at the lab', headline: 'curiosity comes\nalive after dark.', subtitle: 'A moonlit laboratory, a little mystery, and a collection made for serious research.', announcement: 'Welcome to the midnight laboratory', caption: 'moonlight · mystery · discovery' },
  'black-friday': { primary: '0 0% 8%', accent: '43 83% 28%', paper: '45 18% 94%', card: '45 35% 98%', ink: '0 0% 8%', muted: '0 0% 32%', border: '0 0% 67%', glyph: '✳', motif: 'ticket', eyebrow: 'black friday edition', headline: 'bold ideas.\nsharp focus.', subtitle: 'Explore the collection and any current promotions. The price shown on each product is the price that applies.', announcement: 'Black Friday at the lab', caption: 'limited edition look · the same standards' },
  christmas: { primary: '151 66% 22%', accent: '354 68% 34%', paper: '43 55% 97%', card: '42 65% 99%', ink: '151 38% 12%', muted: '150 16% 30%', border: '145 22% 72%', glyph: '✧', motif: 'ornament', eyebrow: 'the festive collection', headline: 'a season full\nof possibility.', subtitle: 'Evergreen details, a festive glow, and a moment to plan the research ahead.', announcement: 'Season’s greetings from the lab', caption: 'evergreen evenings · festive details' },
  'new-year': { primary: '248 52% 29%', accent: '42 80% 28%', paper: '247 45% 97%', card: '250 60% 99%', ink: '247 42% 13%', muted: '248 20% 34%', border: '248 28% 76%', glyph: '✧', motif: 'spark', eyebrow: 'a new year of discovery', headline: 'new year.\nnew questions.', subtitle: 'Celebrate the next chapter. Bring a fresh perspective to your laboratory plans.', announcement: 'Here’s to the next discovery', caption: 'a fresh chapter · endless questions' },
  valentines: { primary: '340 65% 34%', accent: '319 44% 33%', paper: '343 70% 97%', card: '343 75% 99%', ink: '335 42% 15%', muted: '335 20% 34%', border: '338 35% 76%', glyph: '♡', motif: 'heart', eyebrow: 'a love of discovery', headline: 'for the love\nof research.', subtitle: 'Thoughtful details and a softer palette, inspired by a lasting curiosity for science.', announcement: 'Made for curious minds', caption: 'rose-tinted details · lasting curiosity' },
  easter: { primary: '270 45% 35%', accent: '150 52% 25%', paper: '54 70% 97%', card: '56 80% 99%', ink: '270 30% 15%', muted: '270 18% 34%', border: '270 26% 76%', glyph: '✿', motif: 'egg', eyebrow: 'the easter collection', headline: 'small beginnings.\nnew possibilities.', subtitle: 'Pastel skies, botanical details, and a fresh outlook for the season ahead.', announcement: 'A fresh start this Easter', caption: 'pastel skies · thoughtful details' },
  anniversary: { primary: '245 55% 30%', accent: '38 78% 28%', paper: '42 60% 97%', card: '43 70% 99%', ink: '245 38% 14%', muted: '245 18% 34%', border: '38 35% 73%', glyph: '✦', motif: 'ribbon', eyebrow: 'our anniversary edition', headline: 'another chapter\nof discovery.', subtitle: 'Celebrating the people, questions, and possibilities that keep research moving forward.', announcement: 'Thank you for being part of our story', caption: 'celebrating curiosity · looking ahead' },
};
