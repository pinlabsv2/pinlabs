import { useQuery } from '@tanstack/react-query';
import { getStorefront } from '@/lib/api';

export const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export function useStorefront() {
  return useQuery({ queryKey: ['storefront'], queryFn: () => getStorefront({}), staleTime: 60_000 });
}

export const statusTone: Record<string, string> = {
  'Awaiting Payment': 'bg-promo/15 text-promo border-promo/30',
  Paid: 'bg-secondary text-secondary-foreground border-primary/20',
  Processing: 'bg-secondary text-secondary-foreground border-primary/20',
  Shipped: 'bg-primary/10 text-primary border-primary/30',
  'In Transit': 'bg-primary/10 text-primary border-primary/30',
  'Out for Delivery': 'bg-primary/15 text-primary border-primary/40',
  Delivered: 'bg-primary text-primary-foreground border-primary',
  Exception: 'bg-destructive/10 text-destructive border-destructive/30',
  Expired: 'bg-muted text-muted-foreground border-border',
  Cancelled: 'bg-muted text-muted-foreground border-border',
  Refunded: 'bg-muted text-muted-foreground border-border',
};

export const PROGRESS = ['Paid', 'Processing', 'Shipped', 'In Transit', 'Out for Delivery', 'Delivered'];
