import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { activeSeason, designs, seasonalDefaults, seasons, type SeasonalConfig, type Season } from '@/shared/seasons';
import { useStorefront } from '../../lib/store';

type Config = SeasonalConfig & { primary: string; accent: string; storeName: string };
const ClockContext = createContext(0);
export const useSeasonClock = () => useContext(ClockContext);
const Preference = 'pinlabs-seasonal-motion';
const Context = createContext<null | { config: Config; season: Season; design: typeof designs[keyof typeof designs] | null; motion: boolean; reduced: boolean; visitorMotion: boolean; setVisitorMotion: (enabled: boolean) => void }>(null);
export function SeasonProvider({ children, override }: { children: ReactNode; override?: Partial<Config> }) {
  const { data } = useStorefront();
  const [now, setNow] = useState(Date.now());
  const [visitorMotion, setVisitorMotion] = useState(() => { try { return localStorage.getItem(Preference) !== 'off'; } catch { return true; } });
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { media.removeEventListener('change', change); window.clearInterval(timer); };
  }, []);
  const config: Config = useMemo(() => ({
    ...seasonalDefaults, primary: data?.theme.primary ?? '', accent: data?.theme.accent ?? '', storeName: data?.storeName ?? 'PinLabs',
    seasonalTheme: seasons.includes(data?.theme.configuredSeasonal as Season) ? data!.theme.configuredSeasonal as Season : 'default',
    themeIntensity: ['subtle','celebration'].includes(data?.theme.intensity ?? '') ? data!.theme.intensity as Config['themeIntensity'] : 'balanced',
    themeMotion: data?.theme.motion !== false,
    themeHeadline: data?.theme.headline ?? '', themeSubtitle: data?.theme.subtitle ?? '', themeAnnouncement: data?.theme.announcement ?? '',
    themeStartsAt: data?.theme.startsAt ?? '', themeEndsAt: data?.theme.endsAt ?? '', themeCountdownAt: data?.theme.countdownAt ?? '', ...override,
  }), [data, override]);
  // Use the API clock as a reference, then advance with elapsed local time.
  const reference = useMemo(() => ({ local: Date.now(), server: data?.theme.serverTime ? Date.parse(data.theme.serverTime) : Date.now() }), [data?.theme.serverTime]);
  const effectiveNow = override ? now : reference.server + now - reference.local;
  const season = activeSeason(config, effectiveNow);
  const design = season === 'default' ? null : designs[season];
  const motion = config.themeMotion && visitorMotion && !reduced;
  const setMotion = useCallback((enabled: boolean) => { setVisitorMotion(enabled); try { localStorage.setItem(Preference, enabled ? 'on' : 'off'); } catch { /* Session preference remains available. */ } }, []);
  const value = useMemo(() => ({ config, season, design, motion, reduced, visitorMotion, setVisitorMotion: setMotion }), [config, season, design, motion, reduced, visitorMotion, setMotion]);
  return <Context.Provider value={value}><ClockContext.Provider value={effectiveNow}>{children}</ClockContext.Provider></Context.Provider>;
}
export function useSeason() {
  const value = useContext(Context);
  if (!value) throw new Error('SeasonProvider is missing');
  return value;
}
