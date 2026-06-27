import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { createServerSupabase } from '@/db/server';

const dateFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

export default async function AdminDiscountsPage() {
  const supa = await createServerSupabase();
  const { data: codes } = await supa
    .from('discount_codes')
    .select('id, code, kind, value, starts_at, ends_at, max_uses, uses, active')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-ink">Discount codes</h1>
        <Link href="/admin/discounts/new">
          <Button>New code</Button>
        </Link>
      </div>

      {(codes ?? []).length === 0 ? (
        <p className="text-muted">No discount codes yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-paper">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Window</th>
                <th className="px-4 py-3 font-medium">Uses</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(codes ?? []).map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-line transition-colors duration-150 ease-out-soft last:border-0 hover:bg-paper-warm"
                >
                  <td className="px-4 py-3 font-medium tracking-wide text-ink">{d.code}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {d.kind === 'percent' ? `${d.value}%` : `฿${d.value.toLocaleString()}`}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {dateFmt.format(new Date(d.starts_at))} – {dateFmt.format(new Date(d.ends_at))}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {d.uses}
                    {d.max_uses != null ? ` / ${d.max_uses}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        d.active ? 'bg-success/15 text-success' : 'bg-muted/15 text-muted'
                      }`}
                    >
                      {d.active ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/discounts/${d.id}/edit`}
                      className="text-rose-deep transition-colors duration-150 ease-out-soft hover:text-ink hover:underline"
                    >
                      Edit
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
