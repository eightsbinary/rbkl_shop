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
      className="text-xs uppercase tracking-[0.2em] text-muted hover:text-ink transition-colors duration-150 ease-out-soft"
    >
      {other.toUpperCase()}
    </Link>
  );
}
