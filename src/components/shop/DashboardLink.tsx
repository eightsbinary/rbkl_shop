import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getCurrentRole } from '@/db/auth';
import { createServerSupabase } from '@/db/server';

/**
 * Creator entry point in the storefront header. Always rendered, but
 * auth-aware: signed-in creators (owner/dev) get a link straight to the
 * dashboard; everyone else gets a link to the admin sign-in page. Reading the
 * session here opts storefront pages into dynamic rendering — acceptable for a
 * single-creator, low-traffic shop.
 */
export async function DashboardLink() {
  const t = await getTranslations('nav');
  const supa = await createServerSupabase();
  const role = await getCurrentRole(supa);
  const isCreator = role === 'owner' || role === 'dev';

  return (
    <Link href={isCreator ? '/admin' : '/admin/login'} className="transition-colors hover:text-ink">
      {isCreator ? t('dashboard') : t('login')}
    </Link>
  );
}
