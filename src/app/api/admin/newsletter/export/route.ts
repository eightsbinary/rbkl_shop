import { ForbiddenError, requireOwnerOrDev } from '@/db/auth';
import { createServerSupabase } from '@/db/server';

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET() {
  const supa = await createServerSupabase();
  try {
    await requireOwnerOrDev(supa);
  } catch (err) {
    if (err instanceof ForbiddenError) return new Response('Forbidden', { status: 403 });
    throw err;
  }

  const { data, error } = await supa
    .from('newsletter_subscribers')
    .select('email, locale, source, status, created_at')
    .order('created_at', { ascending: false });
  if (error) return new Response('Export failed', { status: 500 });

  const header = 'email,locale,source,status,created_at';
  const rows = (data ?? []).map((r) =>
    [r.email, r.locale, r.source ?? '', r.status, r.created_at].map(csvCell).join(','),
  );
  const csv = [header, ...rows].join('\r\n');

  const filename = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
