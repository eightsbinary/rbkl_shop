import { useTranslations } from 'next-intl';
import type { Database } from '@/db/types.gen';

type Order = Database['public']['Tables']['orders']['Row'];

type StepKey = 'placed' | 'paymentReceived' | 'preparing' | 'shipped' | 'delivered';

function classify(order: Order): StepKey {
  if (order.delivered_at) return 'delivered';
  if (order.shipped_at) return 'shipped';
  if (order.status === 'paid' && order.ship_status === 'preparing') return 'preparing';
  if (order.paid_at) return 'paymentReceived';
  return 'placed';
}

const ORDER: StepKey[] = ['placed', 'paymentReceived', 'preparing', 'shipped', 'delivered'];

export function ShippingTimeline({ order }: { order: Order }) {
  const t = useTranslations('order');
  const current = classify(order);
  const currentIdx = ORDER.indexOf(current);

  const timestamps: Record<StepKey, string | null> = {
    placed: order.created_at,
    paymentReceived: order.paid_at,
    preparing: order.status === 'paid' ? order.paid_at : null,
    shipped: order.shipped_at,
    delivered: order.delivered_at,
  };

  return (
    <ol className="space-y-4">
      {ORDER.map((key, idx) => {
        const reached = idx <= currentIdx;
        const ts = timestamps[key];
        return (
          <li key={key} className="flex items-start gap-3">
            <span
              aria-hidden
              className={`mt-1 inline-block h-3 w-3 rounded-full border ${
                reached ? 'border-ink bg-ink' : 'border-line bg-paper'
              }`}
            />
            <div className="flex-1">
              <p className={reached ? 'text-ink' : 'text-muted'}>{t(key)}</p>
              {ts && (
                <p className="text-xs text-muted">
                  {new Date(ts).toLocaleString('en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
