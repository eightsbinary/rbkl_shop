import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations('footer');
  return (
    <footer className="border-t border-line">
      <div className="container mx-auto flex h-20 items-center justify-between px-6 text-sm text-muted">
        <p>
          {t('copyright')} {new Date().getFullYear()}
        </p>
        <div className="flex items-center gap-4">
          <a
            href="https://www.instagram.com/rainbykello/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink transition-colors"
          >
            IG
          </a>
          <a
            href="https://www.twitch.tv/rainbykello"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink transition-colors"
          >
            Twitch
          </a>
        </div>
      </div>
    </footer>
  );
}
