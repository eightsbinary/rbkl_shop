import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CartIcon } from '@/components/cart/CartIcon';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { DashboardLink } from './DashboardLink';
import { LocaleSwitcher } from './LocaleSwitcher';
import { MobileMenu } from './MobileMenu';

export function Header() {
  const locale = useLocale();
  const t = useTranslations('nav');
  const links = [
    { href: `/${locale}/shop`, label: t('shop') },
    { href: `/${locale}/about`, label: t('about') },
    { href: `/${locale}/track`, label: t('track') },
  ];

  return (
    // `relative` anchors the mobile menu panel to the full header width.
    <header className="relative border-b border-line bg-paper">
      <div className="container mx-auto grid h-16 grid-cols-[1fr_auto_1fr] items-center px-6 md:h-20">
        {/* Left cell: burger below md, the nav row from md up. The three-column
            grid is kept at every width so mobile mirrors the desktop shape. */}
        <div className="flex items-center justify-start">
          <MobileMenu label={t('menu')} closeLabel={t('closeMenu')}>
            <nav className="flex flex-col text-xs uppercase tracking-[0.14em] text-ink-soft">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="py-3 transition-colors hover:text-ink">
                  {l.label}
                </Link>
              ))}
              <DashboardLink className="py-3" />
            </nav>
            <div className="mt-2 flex items-center gap-5 border-t border-line pt-4 text-xs uppercase tracking-[0.14em] text-ink-soft">
              <ThemeToggle label={t('theme')} />
              <LocaleSwitcher />
            </div>
          </MobileMenu>

          <nav className="hidden items-center gap-6 text-xs uppercase tracking-[0.14em] text-ink-soft md:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-ink">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 justify-self-center font-serif text-xl tracking-tight md:gap-2.5 md:text-2xl"
        >
          <Image src="/cross.svg" alt="" width={13} height={13} />
          <span className="wordmark-ombre">rainbykello</span>
          <Image src="/cross.svg" alt="" width={13} height={13} />
        </Link>

        {/* Cart stays in the bar at every width; the rest moves into the menu. */}
        <div className="flex items-center justify-end gap-5 text-xs uppercase tracking-[0.14em] text-ink-soft">
          <div className="hidden md:block">
            <DashboardLink />
          </div>
          <CartIcon label={t('cart')} />
          <div className="hidden items-center gap-5 md:flex">
            <ThemeToggle label={t('theme')} />
            <LocaleSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
