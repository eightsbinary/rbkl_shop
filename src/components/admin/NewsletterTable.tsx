'use client';

import { useTranslations } from 'next-intl';
import type { NewsletterSubscriber } from '@/server/queries/admin-newsletter';

const dateFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

export function NewsletterTable({ subscribers }: { subscribers: NewsletterSubscriber[] }) {
  const t = useTranslations('admin.newsletter');
  if (subscribers.length === 0) {
    return <p className="text-muted">{t('empty')}</p>;
  }

  return (
    <div className="border border-line bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-line text-left text-xs uppercase tracking-[0.12em] text-muted">
          <tr>
            <th className="px-5 py-4 font-medium">{t('colEmail')}</th>
            <th className="px-5 py-4 font-medium">{t('colLanguage')}</th>
            <th className="px-5 py-4 font-medium">{t('colSource')}</th>
            <th className="px-5 py-4 font-medium">{t('colDate')}</th>
          </tr>
        </thead>
        <tbody>
          {subscribers.map((s) => (
            <tr key={s.id} className="border-b border-line last:border-0">
              <td className="px-5 py-4 text-ink">{s.email}</td>
              <td className="px-5 py-4 uppercase text-muted">{s.locale}</td>
              <td className="px-5 py-4 text-muted">{s.source ?? '—'}</td>
              <td className="px-5 py-4 text-muted">{dateFmt.format(new Date(s.createdAt))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
