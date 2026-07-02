import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations('footer');
  const locale = useLocale();
  return (
    <footer className="border-t border-line bg-paper">
      <div className="container mx-auto flex flex-col gap-8 px-6 py-16 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <p className="flex items-center gap-2 font-serif text-xl">
            <Image src="/cross.svg" alt="" width={11} height={11} />
            <span className="wordmark-ombre">rainbykello</span>
          </p>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">
            {t('copyright')} {new Date().getFullYear()}
          </p>
        </div>
        <div className="flex items-center gap-6 text-xs uppercase tracking-[0.14em] text-ink-soft">
          <Link href={`/${locale}/track`} className="transition-colors hover:text-ink">
            {t('track')}
          </Link>
          <a
            href="https://www.instagram.com/rainbykello/"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-ink"
          >
            Instagram
          </a>
          <a
            href="https://www.twitch.tv/rainbykello"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-ink"
          >
            Twitch
          </a>
        </div>
      </div>
    </footer>
  );
}
