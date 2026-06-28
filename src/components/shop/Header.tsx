import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CartIcon } from '@/components/cart/CartIcon';
import { LocaleSwitcher } from './LocaleSwitcher';

export function Header() {
  const locale = useLocale();
  const t = useTranslations('nav');
  return (
    <header className="border-b border-line bg-paper">
      <div className="container mx-auto grid h-20 grid-cols-[1fr_auto_1fr] items-center px-6">
        <nav className="flex items-center gap-6 text-xs uppercase tracking-[0.14em] text-ink-soft">
          <Link href={`/${locale}/shop`} className="transition-colors hover:text-ink">
            {t('shop')}
          </Link>
        </nav>
        <Link
          href={`/${locale}`}
          className="justify-self-center font-serif text-2xl tracking-tight text-ink"
        >
          rainbykello
        </Link>
        <div className="flex items-center justify-end gap-5 text-xs uppercase tracking-[0.14em] text-ink-soft">
          <CartIcon label={t('cart')} />
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
