'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const other = locale === 'th' ? 'en' : 'th';
  const next = pathname.replace(/^\/(th|en)(\/|$)/, `/${other}$2`);
  return (
    <Link
      href={next || `/${other}`}
      className="inline-block text-xs uppercase tracking-[0.2em] text-muted transition-all duration-150 ease-out-soft hover:-translate-y-px hover:text-ink active:scale-90"
    >
      {other.toUpperCase()}
    </Link>
  );
}
