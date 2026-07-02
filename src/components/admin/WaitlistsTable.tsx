'use client';

import { useTranslations } from 'next-intl';
import type { WaitlistGroup } from '@/server/queries/admin-waitlists';

const dateFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

export function WaitlistsTable({ groups }: { groups: WaitlistGroup[] }) {
  const t = useTranslations('admin.waitlists');
  if (groups.length === 0) {
    return <p className="text-muted">{t('empty')}</p>;
  }

  return (
    <div className="border border-line bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-line text-left text-xs uppercase tracking-[0.12em] text-muted">
          <tr>
            <th className="px-5 py-4 font-medium">{t('colProduct')}</th>
            <th className="px-5 py-4 font-medium">{t('colWaiting')}</th>
            <th className="px-5 py-4 font-medium">{t('colSince')}</th>
            <th className="px-5 py-4 font-medium">{t('colStock')}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const restockReady = g.stockAvailable > 0;
            return (
              <tr key={g.variantId} className="border-b border-line last:border-0">
                <td className="px-5 py-4 text-ink">
                  {g.productName}
                  {g.optionLabel && <span className="text-muted"> · {g.optionLabel}</span>}
                </td>
                <td className="px-5 py-4 font-medium text-ink">{g.count}</td>
                <td className="px-5 py-4 text-muted">{dateFmt.format(new Date(g.earliest))}</td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      restockReady ? 'bg-success/15 text-success' : 'bg-muted/15 text-muted'
                    }`}
                  >
                    {restockReady ? t('inStock', { count: g.stockAvailable }) : t('soldOut')}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
