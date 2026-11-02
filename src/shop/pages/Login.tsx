import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Label } from '@/ui-kit/ui/label';
import { login, register } from '@/lib/auth';

export default function Login() {
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/';
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (mode === 'signin') await login(form.email, form.password);
      else {
        if (form.password.length < 8) throw new Error('Password must be at least 8 characters.');
        await register(form);
      }
      window.location.href = redirect.startsWith('/') ? redirect : '/';
    } catch (err: any) { setError(err?.message ?? 'Something went wrong'); }
    finally { setBusy(false); }
  };

  return (
    <div className="container mx-auto px-4 py-16 max-w-sm">
      <h1 className="text-2xl font-bold mb-1">{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
      <p className="text-sm text-muted-foreground mb-6">{mode === 'signin' ? 'Welcome back.' : 'Takes 10 seconds.'}</p>
      <form onSubmit={submit} className="space-y-4">
        {mode === 'signup' && (
          <div className="grid grid-cols-2 gap-3">
            <div><Label>First name</Label><Input value={form.firstName} onChange={f('firstName')} /></div>
            <div><Label>Last name</Label><Input value={form.lastName} onChange={f('lastName')} /></div>
          </div>
        )}
        <div><Label>Email</Label><Input type="email" required value={form.email} onChange={f('email')} autoComplete="email" /></div>
        <div><Label>Password</Label><Input type="password" required value={form.password} onChange={f('password')} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}{mode === 'signin' ? 'Sign in' : 'Create account'}</Button>
      </form>
      <p className="text-sm text-muted-foreground mt-6 text-center">
        {mode === 'signin' ? 'No account yet? ' : 'Already have an account? '}
        <button className="underline text-foreground" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}>
          {mode === 'signin' ? 'Create one' : 'Sign in'}
        </button>
      </p>
      <p className="text-center mt-2"><Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to shop</Link></p>
    </div>
  );
}
