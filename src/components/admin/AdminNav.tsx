import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AdminLocaleToggle } from '@/components/admin/AdminLocaleToggle';
import { getCurrentRole } from '@/db/auth';
import { createServerSupabase } from '@/db/server';
import { signOutAdmin } from '@/server/actions/auth';

const linkClass =
  'relative transition-colors duration-150 ease-out-soft after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-200 after:ease-out-soft hover:text-ink hover:after:scale-x-100';

export async function AdminNav() {
  const supa = await createServerSupabase();
  const role = await getCurrentRole(supa);
  const t = await getTranslations('admin.nav');

  const links = [
    { href: '/admin/products', label: t('products') },
    { href: '/admin/orders', label: t('orders') },
    { href: '/admin/discounts', label: t('discounts') },
    { href: '/admin/waitlists', label: t('waitlists') },
    { href: '/admin/newsletter', label: t('newsletter') },
    { href: '/admin/settings', label: t('settings') },
    { href: '/admin/about', label: t('about') },
    ...(role === 'dev' ? [{ href: '/admin/sync', label: t('sync') }] : []),
  ];

  return (
    <header className="border-b border-line bg-paper">
      <div className="container mx-auto flex h-20 items-center justify-between px-6">
        <Link
          href="/admin"
          className="font-serif text-2xl tracking-tight text-ink transition-colors hover:text-ink-soft"
        >
          rainbykello
          <span className="ml-2 align-middle text-[10px] uppercase tracking-[0.2em] text-muted">
            {t('badge')}
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-xs uppercase tracking-[0.14em] text-ink-soft">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass}>
              {l.label}
            </Link>
          ))}
          <form action={signOutAdmin}>
            <button
              type="submit"
              className="uppercase tracking-[0.14em] text-muted transition-colors duration-150 ease-out-soft hover:text-ink active:scale-95"
            >
              {t('signOut')}
            </button>
          </form>
          <AdminLocaleToggle />
        </nav>
      </div>
    </header>
  );
}
