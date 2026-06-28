import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations('footer');
  return (
    <footer className="border-t border-line bg-paper">
      <div className="container mx-auto flex flex-col gap-8 px-6 py-16 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <p className="font-serif text-xl text-ink">rainbykello</p>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">
            {t('copyright')} {new Date().getFullYear()}
          </p>
        </div>
        <div className="flex items-center gap-6 text-xs uppercase tracking-[0.14em] text-ink-soft">
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
