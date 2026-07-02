import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CartIcon } from '@/components/cart/CartIcon';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { DashboardLink } from './DashboardLink';
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
          <Link href={`/${locale}/about`} className="transition-colors hover:text-ink">
            {t('about')}
          </Link>
        </nav>
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2.5 justify-self-center font-serif text-2xl tracking-tight"
        >
          <Image src="/cross.svg" alt="" width={13} height={13} />
          <span className="wordmark-ombre">rainbykello</span>
          <Image src="/cross.svg" alt="" width={13} height={13} />
        </Link>
        <div className="flex items-center justify-end gap-5 text-xs uppercase tracking-[0.14em] text-ink-soft">
          <DashboardLink />
          <CartIcon label={t('cart')} />
          <ThemeToggle label={t('theme')} />
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
