import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { getCurrentRole } from '@/db/auth';
import { createServerSupabase } from '@/db/server';

/**
 * Per-request memo of the viewer's role. The header renders DashboardLink
 * twice below `md` (once in the mobile menu, once in the desktop bar, each
 * hidden at the other's breakpoint), and without this every storefront page
 * would run two getUser() round-trips plus two profile reads.
 */
const getRole = cache(async () => {
  const supa = await createServerSupabase();
  return getCurrentRole(supa);
});

/**
 * Creator entry point in the storefront header. Always rendered, but
 * auth-aware: signed-in creators (owner/dev) get a link straight to the
 * dashboard; everyone else gets a link to the admin sign-in page. Reading the
 * session here opts storefront pages into dynamic rendering — acceptable for a
 * single-creator, low-traffic shop.
 */
export async function DashboardLink({ className = '' }: { className?: string }) {
  const t = await getTranslations('nav');
  const role = await getRole();
  const isCreator = role === 'owner' || role === 'dev';

  return (
    <Link
      href={isCreator ? '/admin' : '/admin/login'}
      className={`transition-colors hover:text-ink ${className}`}
    >
      {isCreator ? t('dashboard') : t('login')}
    </Link>
  );
}
