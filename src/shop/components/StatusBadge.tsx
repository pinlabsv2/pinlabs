import { cn } from '@/ui-kit/lib/utils';
import { statusTone } from '../lib/store';

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
      statusTone[status] ?? 'bg-muted text-muted-foreground')}>
      {status}
    </span>
  );
}
