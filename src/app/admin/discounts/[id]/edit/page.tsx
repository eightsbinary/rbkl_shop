import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DiscountForm, type DiscountFormValues } from '@/components/admin/DiscountForm';
import { createServerSupabase } from '@/db/server';

/** timestamptz ISO → 'YYYY-MM-DDTHH:mm' for <input type="datetime-local">. */
const toLocalInput = (iso: string) => new Date(iso).toISOString().slice(0, 16);

export default async function EditDiscountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supa = await createServerSupabase();
  const { data: d } = await supa
    .from('discount_codes')
    .select('id, code, kind, value, min_subtotal_thb, starts_at, ends_at, max_uses, active')
    .eq('id', id)
    .maybeSingle();
  if (!d) notFound();

  const initial: DiscountFormValues = {
    code: d.code,
    kind: d.kind === 'percent' ? 'percent' : 'fixed',
    value: String(d.value),
    minSubtotalThb: String(d.min_subtotal_thb),
    startsAt: toLocalInput(d.starts_at),
    endsAt: toLocalInput(d.ends_at),
    maxUses: d.max_uses != null ? String(d.max_uses) : '',
    active: d.active,
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/admin/discounts"
          className="text-sm text-muted transition-colors duration-150 ease-out-soft hover:text-ink"
        >
          ← Discount codes
        </Link>
        <h1 className="font-serif text-3xl text-ink">Edit {d.code}</h1>
      </div>
      <DiscountForm mode="edit" id={d.id} initial={initial} />
    </div>
  );
}
