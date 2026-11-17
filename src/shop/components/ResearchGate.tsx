import { useState, type ReactNode } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useStorefront } from '../lib/store';
import { Button } from '@/ui-kit/ui/button';

const KEY = 'pinlabs-research-acceptance-v1';
export function readAcceptance(): { minimumAge: number; researchOnly: true } | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return value?.version === 1 && value.researchOnly === true && [18, 21].includes(value.minimumAge) ? value : null;
  } catch { return null; }
}

export default function ResearchGate({ children }: { children: ReactNode }) {
  const { data, isError, refetch } = useStorefront();
  const location = useLocation();
  const [accepted, setAccepted] = useState(readAcceptance);
  const [age, setAge] = useState(false);
  const [research, setResearch] = useState(false);
  const [declined, setDeclined] = useState(false);
  // Legal information and unsubscribe remain reachable without agreeing to shop.
  if (location.pathname.startsWith('/policies/') || location.pathname === '/unsubscribe' || location.pathname === '/support') return <>{children}</>;
  if (!data) return <div className="min-h-screen grid place-items-center p-8">{isError ? <Button onClick={() => refetch()}>Retry loading store</Button> : <p>Loading store requirements…</p>}</div>;
  if (accepted && accepted.minimumAge >= data.minimumAge) return <>{children}</>;
  return <div className="min-h-screen grid place-items-center bg-background p-5"><section role="dialog" aria-modal="true" aria-labelledby="research-heading" aria-describedby="research-description" className="w-full max-w-xl border bg-card p-6 sm:p-10 space-y-5">
    <p className="text-xs font-mono uppercase tracking-widest text-primary">{data.storeName} · restricted access</p>
    <h1 id="research-heading" className="text-3xl">laboratory research only</h1>
    <p id="research-description" className="text-sm text-muted-foreground">These materials are intended exclusively for lawful laboratory research by qualified researchers. They are not medicines, food, supplements, or cosmetics. Never ingest, inject, or administer them to people or animals. No dosing or medical advice is provided.</p>
    {declined ? <p role="status">You cannot enter the store without meeting these requirements. You may close this page or review our policies below.</p> : <>
      <label className="flex gap-3 items-start text-sm"><input autoFocus type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} className="mt-1" /><span>I am at least {data.minimumAge} years old and meet any higher local age requirement.</span></label>
      <label className="flex gap-3 items-start text-sm"><input type="checkbox" checked={research} onChange={(e) => setResearch(e.target.checked)} className="mt-1" /><span>I will purchase and use these materials only for lawful laboratory research, with suitable training, facilities, and safety procedures; never for human or veterinary use.</span></label>
      <div className="flex flex-wrap gap-3"><Button disabled={!age || !research} onClick={() => {
        const value = { version: 1, minimumAge: data.minimumAge, researchOnly: true as const };
        try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* Session-only acceptance when storage is blocked. */ }
        setAccepted(value);
      }}>Accept and enter</Button><Button variant="outline" onClick={() => setDeclined(true)}>I do not agree</Button></div>
    </>}
    <nav className="flex flex-wrap gap-4 text-xs underline"><Link to="/policies/terms">Terms</Link><Link to="/policies/privacy">Privacy</Link><Link to="/support">Contact</Link></nav>
    <p className="text-xs text-muted-foreground">This declaration does not replace identity, licence, or suitability checks, and does not waive mandatory legal rights.</p>
  </section></div>;
}
