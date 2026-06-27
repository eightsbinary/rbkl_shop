import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CartIcon } from '@/components/cart/CartIcon';
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
        <nav className="flex items-center gap-6 text-sm text-ink-soft">
          <Link
            href={`/${locale}/shop`}
            className="relative transition-colors duration-150 ease-out-soft after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-200 after:ease-out-soft hover:text-ink hover:after:scale-x-100"
          >
            {t('shop')}
          </Link>
          <CartIcon label={t('cart')} />
          <LocaleSwitcher />
        </nav>
      </div>
    </header>
  );
}
