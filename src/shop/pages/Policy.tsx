import { Link, Navigate, useParams } from 'react-router-dom';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import { Markdown } from '@/ui-kit/markdown';
import { useStorefront } from '../lib/store';

export const POLICIES = [
  { slug: 'terms', key: 'terms', title: 'Terms of Service' },
  { slug: 'privacy', key: 'privacy', title: 'Privacy Policy' },
  { slug: 'shipping', key: 'shipping', title: 'Shipping Policy' },
  { slug: 'refunds', key: 'refund', title: 'Refund Policy' },
] as const;

export default function Policy() {
  const { slug } = useParams();
  const { data, isLoading } = useStorefront();
  const policy = POLICIES.find((p) => p.slug === slug);
  if (!policy) return <Navigate to="/" />;
  const text = data?.policies[policy.key] ?? '';
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <nav className="flex flex-wrap gap-2 mb-8">
        {POLICIES.map((p) => (
          <Link key={p.slug} to={`/policies/${p.slug}`}
            className={`rounded-none border px-3 py-1 text-xs font-mono ${p.slug === slug ? 'bg-foreground text-background border-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{p.title}</Link>
        ))}
      </nav>
      <h1 className="text-3xl font-bold tracking-tight">{policy.title}</h1>
      <div className="mt-6">
        {isLoading ? <Skeleton className="h-64" /> : text.trim()
          ? <div className="prose prose-sm max-w-none dark:prose-invert"><Markdown>{text}</Markdown></div>
          : <p className="text-muted-foreground">This policy hasn't been published yet.</p>}
      </div>
    </div>
  );
}
