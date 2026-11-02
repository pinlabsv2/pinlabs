import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpDown, Loader2, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { listOrders, refreshTracking } from '@/lib/api';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Skeleton } from '@/ui-kit/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-kit/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui-kit/ui/table';
import StatusBadge, { STATUSES, usd } from '../components/StatusBadge';
import OrderSheet from '../components/OrderSheet';

const PAGE = 20;

export default function Orders() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['orders'], queryFn: () => listOrders({}) });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState<{ key: 'createdAt' | 'total'; dir: 1 | -1 }>({ key: 'createdAt', dir: -1 });
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const rows = useMemo(() => {
    const s = q.toLowerCase();
    return (data?.orders ?? [])
      .filter((o) => (status === 'all' || o.status === status) &&
        `${o.orderNumber} ${o.customerName} ${o.customerEmail} ${o.trackingNumber}`.toLowerCase().includes(s))
      .sort((a, b) => (sort.key === 'total' ? a.total - b.total : (a.createdAt ?? '').localeCompare(b.createdAt ?? '')) * sort.dir);
  }, [data, q, status, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const open = data?.orders.find((o) => o.id === openId) ?? null;
  const toggle = (key: 'createdAt' | 'total') => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }));

  const checkAll = async () => {
    setChecking(true);
    try { const r = await refreshTracking({}); toast.success(`Checked ${r.checked} shipments, ${r.moved} moved`); qc.invalidateQueries({ queryKey: ['orders'] }); }
    catch (e: any) { toast.error(e?.message ?? 'Check failed'); } finally { setChecking(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1"><Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search order #, customer, tracking" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" onClick={checkAll} disabled={checking}>{checking ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Check all shipments</Button>
      </div>
      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Order</TableHead><TableHead>Customer</TableHead>
            <TableHead><button className="flex items-center gap-1" onClick={() => toggle('createdAt')}>Placed<ArrowUpDown className="size-3" /></button></TableHead>
            <TableHead>Status</TableHead><TableHead>Tracking</TableHead>
            <TableHead className="text-right"><button className="inline-flex items-center gap-1" onClick={() => toggle('total')}>Total<ArrowUpDown className="size-3" /></button></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6" /></TableCell></TableRow>)
              : rows.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">No orders found.</TableCell></TableRow>
              : rows.slice(page * PAGE, page * PAGE + PAGE).map((o) => (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => setOpenId(o.id)}>
                  <TableCell className="font-mono font-medium">{o.orderNumber}</TableCell>
                  <TableCell><div>{o.customerName}</div><div className="text-xs text-muted-foreground">{o.customerEmail}</div></TableCell>
                  <TableCell className="text-sm">{o.createdAt && new Date(o.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell className="font-mono text-xs">{o.trackingNumber || '—'}<div className="text-muted-foreground font-sans">{o.trackingStatus}</div></TableCell>
                  <TableCell className="text-right font-mono">{usd(o.total)}<div className="text-xs text-muted-foreground">{o.payCurrency}</div></TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{rows.length} orders</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>{page + 1} / {pages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>
      <OrderSheet order={open} onClose={() => setOpenId(null)} />
    </div>
  );
}
