import { Input } from '@/ui-kit/ui/input';
import { Label } from '@/ui-kit/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-kit/ui/select';

export type Address = { street: string; city: string; postalCode: string; country: string };

const CODES: Record<string, string> = { 'Australia': 'AU', 'Austria': 'AT', 'Belgium': 'BE', 'Brazil': 'BR', 'Bulgaria': 'BG', 'Canada': 'CA', 'Croatia': 'HR', 'Cyprus': 'CY', 'Czech Republic': 'CZ', 'Denmark': 'DK', 'Estonia': 'EE', 'Finland': 'FI', 'France': 'FR', 'Germany': 'DE', 'Greece': 'GR', 'Hong Kong': 'HK', 'Hungary': 'HU', 'Iceland': 'IS', 'Ireland': 'IE', 'Israel': 'IL', 'Italy': 'IT', 'Japan': 'JP', 'Latvia': 'LV', 'Lithuania': 'LT', 'Luxembourg': 'LU', 'Malta': 'MT', 'Mexico': 'MX', 'Netherlands': 'NL', 'New Zealand': 'NZ', 'Norway': 'NO', 'Poland': 'PL', 'Portugal': 'PT', 'Romania': 'RO', 'Serbia': 'RS', 'Singapore': 'SG', 'Slovakia': 'SK', 'Slovenia': 'SI', 'South Africa': 'ZA', 'South Korea': 'KR', 'Spain': 'ES', 'Sweden': 'SE', 'Switzerland': 'CH', 'Taiwan': 'TW', 'Thailand': 'TH', 'Turkey': 'TR', 'Ukraine': 'UA', 'United Arab Emirates': 'AE', 'United Kingdom': 'GB', 'United States': 'US' };
const COUNTRIES = Object.keys(CODES);
export const flag = (country: string) => (CODES[country] ?? '').replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="text-sm text-destructive mt-1">{msg}</p> : null;
}

export default function AddressFields({ value, onChange, errors }: { value: Address; onChange: (a: Address) => void; errors: Record<string, string> }) {
  const set = (k: keyof Address, v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-6 gap-3">
      <div className="col-span-6"><Label>Country</Label>
        <Select value={value.country || undefined} onValueChange={(v) => set('country', v)}>
          <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select country" /></SelectTrigger>
          <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}><span className="mr-2">{flag(c)}</span>{c}</SelectItem>)}</SelectContent>
        </Select><Err msg={errors.country} /></div>
      <div className="col-span-6"><Label>Street address</Label>
        <Input className="mt-1.5" autoComplete="street-address" placeholder="Street, number, apt" value={value.street} onChange={(e) => set('street', e.target.value)} /><Err msg={errors.street} /></div>
      <div className="col-span-2"><Label>Postal code</Label>
        <Input className="mt-1.5 font-mono" autoComplete="postal-code" value={value.postalCode} onChange={(e) => set('postalCode', e.target.value)} /><Err msg={errors.postalCode} /></div>
      <div className="col-span-4"><Label>City</Label>
        <Input className="mt-1.5" autoComplete="address-level2" value={value.city} onChange={(e) => set('city', e.target.value)} /><Err msg={errors.city} /></div>
    </div>
  );
}
