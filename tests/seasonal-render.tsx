// Static React rendering only: no browser, network, or persistent application state.
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { designs, seasons, seasonalDefaults } from '../shared/seasonal';
import { SeasonProvider } from '../src/shop/components/seasonal/SeasonProvider';
import { SeasonalHero, SeasonalNavDecor, SeasonalDivider, SeasonalCardDecoration, SeasonalEmpty, SeasonalMotionControl, SeasonalCheckoutAccent } from '../src/shop/components/seasonal/SeasonalExperience';
import ThemeColors from '../src/shop/components/ThemeColors';
let reducedMotion = false;
let storedMotion: string | null = null;
Object.defineProperty(globalThis, 'window', { value: { matchMedia: () => ({ matches: reducedMotion }) }, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => storedMotion, setItem: (_key: string, value: string) => { storedMotion = value; } }, configurable: true });
const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
client.setQueryData(['storefront'], { theme: { seasonal: 'default', configuredSeasonal: 'default', primary: '', accent: '', intensity: 'balanced', motion: true, headline: '', subtitle: '', announcement: '', startsAt: '', endsAt: '', countdownAt: '', serverTime: new Date().toISOString() }, storeName: 'Test store' });
const markup = new Set<string>();
for (const season of seasons) {
  const config = { ...seasonalDefaults, seasonalTheme: season, storeName: 'Test store', themeCountdownAt: new Date(Date.now()+60000).toISOString() };
  const render = (extra = {}) => renderToStaticMarkup(<QueryClientProvider client={client}><StaticRouter location="/"><SeasonProvider override={{...config,...extra}}><ThemeColors/><SeasonalHero/><SeasonalNavDecor/><SeasonalDivider/><SeasonalCardDecoration/><SeasonalEmpty/><SeasonalCheckoutAccent/><SeasonalMotionControl/></SeasonProvider></StaticRouter></QueryClientProvider>);
  const html = render();
  if (season === 'default') { assert.equal(html, ''); continue; }
  assert.ok(html.includes(`season-scene--${season}`), season);
  assert.ok(html.includes('season-product') || html.includes('season-card-decoration'));
  assert.ok(html.includes('season-countdown'));
  assert.ok(html.includes('season-empty'));
  assert.ok(html.includes('season-nav-decor'));
  assert.ok(html.includes('aria-pressed="false"'));
  assert.ok(!html.includes('NaN') && !html.includes('undefined'));
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.ok(render({ themeMotion: false }).includes('motion off'));
  assert.ok(!render({ themeMotion: false }).includes('seasonal-ambience'));
  for (const [themeIntensity, expected] of [['subtle',6],['balanced',14],['celebration',26]] as const) assert.equal((render({themeIntensity}).match(/style="left:/g) || []).length, expected);
  reducedMotion = true;
  assert.ok(!render().includes('seasonal-ambience'));
  assert.ok(render().includes('by your device preference'));
  reducedMotion = false;
  storedMotion = 'off';
  assert.ok(!render().includes('seasonal-ambience'));
  storedMotion = null;
  const malicious = render({ themeHeadline: '<script>bad()</script>', themeSubtitle: '<img src=x onerror=bad()>', themeAnnouncement: '<b>sale</b>' });
  assert.ok(!malicious.includes('<script>') && !malicious.includes('<img src=x'));
  assert.ok(malicious.includes('&lt;script&gt;'));
  assert.ok(!render({ themeCountdownAt: '2000-01-01T00:00:00Z' }).includes('season-countdown'));
  markup.add(html);
}
assert.equal(markup.size, Object.keys(designs).length);
client.clear();
console.log('PASS: all 12 designs render, unique scenes, accessible decoration controls, countdown expiry, motion disabled, and escaped custom copy.');
