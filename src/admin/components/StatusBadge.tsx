import { cn } from '@/ui-kit/lib/utils';

const tone: Record<string, string> = {
  'Awaiting Payment': 'bg-promo/15 text-promo border-promo/30',
  Paid: 'bg-secondary text-secondary-foreground border-primary/20',
  Processing: 'bg-secondary text-secondary-foreground border-primary/20',
  Shipped: 'bg-primary/10 text-primary border-primary/30',
  'In Transit': 'bg-primary/10 text-primary border-primary/30',
  'Out for Delivery': 'bg-primary/15 text-primary border-primary/40',
  Delivered: 'bg-primary text-primary-foreground border-primary',
  Exception: 'bg-destructive/10 text-destructive border-destructive/30',
  Refunded: 'bg-muted text-muted-foreground line-through',
};

export const STATUSES = ['Awaiting Payment', 'Paid', 'Processing', 'Shipped', 'In Transit', 'Out for Delivery', 'Delivered', 'Exception', 'Expired', 'Cancelled', 'Refunded'];
export const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default function StatusBadge({ status }: { status: string }) {
  return <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', tone[status] ?? 'bg-muted text-muted-foreground')}>{status}</span>;
}
