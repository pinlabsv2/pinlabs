import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { unsubscribeMarketing } from '@/lib/api';
import { Button } from '@/ui-kit/ui/button';

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  useEffect(() => {
    unsubscribeMarketing({ token }).catch(() => null).finally(() => setDone(true));
  }, [token]);
  return <div className="container mx-auto max-w-lg px-4 py-24 text-center">
    {done ? <CheckCircle2 className="mx-auto size-10" /> : <Loader2 className="mx-auto size-10 animate-spin" />}
    <h1 className="mt-5 text-3xl font-semibold lowercase">{done ? 'email preferences updated' : 'updating preferences'}</h1>
    <p className="mt-3 text-sm text-muted-foreground">{done ? 'You will no longer receive promotional announcements. Order, payment, and shipping emails are unaffected.' : 'Please wait a moment.'}</p>
    {done && <Button asChild className="mt-7"><Link to="/">Return to shop</Link></Button>}
  </div>;
}
