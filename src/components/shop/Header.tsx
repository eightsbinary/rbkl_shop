import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { LocaleSwitcher } from './LocaleSwitcher';

export function Header() {
  const locale = useLocale();
  const t = useTranslations('nav');
  return (
    <header className="border-b border-line">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <Link
          href={`/${locale}`}
          className="font-serif text-xl text-ink hover:text-rose-deep transition-colors duration-150 ease-out-soft"
        >
          rainbykello
        </Link>
        <nav className="flex items-center gap-8 text-sm text-ink-soft">
          <Link
            href={`/${locale}/shop`}
            className="hover:text-ink transition-colors duration-150 ease-out-soft"
          >
            {t('shop')}
          </Link>
          <LocaleSwitcher />
        </nav>
      </div>
    </header>
  );
}
