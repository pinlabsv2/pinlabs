import { Check, MapPin } from 'lucide-react';
import { cn } from '@/ui-kit/lib/utils';
import type { GetMyOrderOutputType } from '@/lib/api';
import { PROGRESS } from '../lib/store';

type Order = GetMyOrderOutputType['order'];

export function ProgressSteps({ status }: { status: string }) {
  const idx = PROGRESS.indexOf(status);
  return (
    <div className="flex items-center">
      {PROGRESS.map((s, i) => (
        <div key={s} className="flex-1 flex flex-col items-center gap-2 relative">
          {i > 0 && <div className={cn('absolute top-3 right-1/2 w-full h-0.5', i <= idx ? 'bg-primary' : 'bg-border')} />}
          <div className={cn('relative z-10 size-6 rounded-full grid place-items-center border-2',
            i <= idx ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-border')}>
            {i <= idx && <Check className="size-3" />}
          </div>
          <span className={cn('text-[11px] text-center leading-tight', i <= idx ? 'text-foreground font-medium' : 'text-muted-foreground')}>{s}</span>
        </div>
      ))}
    </div>
  );
}

export default function TrackingTimeline({ order }: { order: Order }) {
  if (!order.trackingNumber) return <p className="text-sm text-muted-foreground">Tracking details appear here once your order ships.</p>;
  return (
    <div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mb-4">
        <span>Tracking: <b className="font-mono">{order.trackingNumber}</b></span>
        {order.carrier && <span>Carrier: <b>{order.carrier}</b></span>}
        {order.lastTrackingCheck && <span className="text-muted-foreground">Updated {new Date(order.lastTrackingCheck).toLocaleString()}</span>}
      </div>
      {order.trackingEvents.length === 0 ? (
        <p className="text-sm text-muted-foreground">The carrier hasn't posted any scans yet.</p>
      ) : (
        <ol className="relative border-l ml-2 space-y-5">
          {order.trackingEvents.map((e, i) => (
            <li key={i} className="pl-5 relative">
              <span className={cn('absolute -left-[5px] top-1.5 size-2.5 rounded-full', i === 0 ? 'bg-primary ring-4 ring-primary/20' : 'bg-border')} />
              <p className={cn('text-sm', i === 0 && 'font-medium')}>{e.description}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                {e.time && new Date(e.time).toLocaleString()}{e.location && <><MapPin className="size-3 ml-2" />{e.location}</>}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
