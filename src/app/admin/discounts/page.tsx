import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/Button';
import { createServerSupabase } from '@/db/server';

const dateFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

export default async function AdminDiscountsPage() {
  const supa = await createServerSupabase();
  const { data: codes } = await supa
    .from('discount_codes')
    .select('id, code, kind, value, starts_at, ends_at, max_uses, uses, active')
    .order('created_at', { ascending: false });

  const t = await getTranslations('admin.discounts');
  const tc = await getTranslations('admin.common');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-ink">{t('title')}</h1>
        <Link href="/admin/discounts/new">
          <Button variant="solid">{t('newCode')}</Button>
        </Link>
      </div>

      {(codes ?? []).length === 0 ? (
        <p className="text-muted">{t('empty')}</p>
      ) : (
        <div className="border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="px-5 py-4 font-medium">{t('colCode')}</th>
                <th className="px-5 py-4 font-medium">{t('colDiscount')}</th>
                <th className="px-5 py-4 font-medium">{t('colWindow')}</th>
                <th className="px-5 py-4 font-medium">{t('colUses')}</th>
                <th className="px-5 py-4 font-medium">{tc('status')}</th>
                <th className="px-5 py-4" />
              </tr>
            </thead>
            <tbody>
              {(codes ?? []).map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-line transition-colors duration-150 ease-out-soft last:border-0 hover:bg-field"
                >
                  <td className="px-5 py-4 font-medium tracking-wide text-ink">{d.code}</td>
                  <td className="px-5 py-4 text-ink-soft">
                    {d.kind === 'percent' ? `${d.value}%` : `฿${d.value.toLocaleString()}`}
                  </td>
                  <td className="px-5 py-4 text-muted">
                    {dateFmt.format(new Date(d.starts_at))} – {dateFmt.format(new Date(d.ends_at))}
                  </td>
                  <td className="px-5 py-4 text-ink-soft">
                    {d.uses}
                    {d.max_uses != null ? ` / ${d.max_uses}` : ''}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        d.active ? 'bg-success/15 text-success' : 'bg-muted/15 text-muted'
                      }`}
                    >
                      {d.active ? tc('active') : tc('inactive')}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/discounts/${d.id}/edit`}
                      className="text-ink underline-offset-2 transition-colors duration-150 ease-out-soft hover:underline"
                    >
                      {tc('editLink')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
