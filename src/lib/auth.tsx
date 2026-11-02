// Client-side auth: the session lives in an httpOnly cookie set by /api/authLogin and /api/authRegister.
import { useSyncExternalStore } from 'react';
import { authMe, authLogin, authRegister, authLogout, type AuthMeOutputType } from './api';

export type User = NonNullable<AuthMeOutputType['user']> & { name: string };
type State = { user: User | null; isLoading: boolean };

let state: State = { user: null, isLoading: true };
const subs = new Set<() => void>();
const set = (s: State) => { state = s; subs.forEach((f) => f()); };
const withName = (u: AuthMeOutputType['user']): User | null =>
  u ? { ...u, name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email } : null;

let loaded = false;
export function refreshUser() {
  return authMe({}).then((r) => set({ user: withName(r.user), isLoading: false })).catch(() => set({ user: null, isLoading: false }));
}

export function useAuth() {
  if (!loaded) { loaded = true; refreshUser(); }
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => state);
}

/** Sends the visitor to the sign-in page and brings them back afterwards. */
export function loginWithRedirect(opts: { redirectUrl?: string } = {}) {
  const back = opts.redirectUrl ?? window.location.pathname + window.location.search;
  window.location.href = `/login?redirect=${encodeURIComponent(back)}`;
}

export async function login(email: string, password: string) {
  const r = await authLogin({ email, password }); set({ user: withName(r.user), isLoading: false });
}
export async function register(input: { email: string; password: string; firstName?: string; lastName?: string }) {
  const r = await authRegister(input); set({ user: withName(r.user), isLoading: false });
}
export async function logout() {
  await authLogout({}); set({ user: null, isLoading: false }); window.location.href = '/';
}
