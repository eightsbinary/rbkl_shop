'use client';

import { useEffect } from 'react';
import { resolveTheme, THEME_STORAGE_KEY, type Theme } from '@/lib/theme';

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

function readStored(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode) — treat as "no stored choice".
    return null;
  }
}

/** Light/dark switch. Shows the theme a click switches TO (moon in light mode,
 *  sun in dark); icon visibility is CSS-driven off html[data-theme], so server
 *  markup never mismatches. */
export function ThemeToggle({ label }: { label: string }) {
  // Until the visitor makes an explicit choice, follow live system changes.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      applyTheme(resolveTheme(readStored(), e.matches));
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  function toggle() {
    const next: Theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private-mode storage failure — still flip the theme for this page view.
    }
    applyTheme(next);
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={toggle}
      className="inline-flex text-muted transition-all duration-150 ease-out-soft hover:-translate-y-px hover:text-ink active:scale-90"
    >
      {/* moon — visible in light mode */}
      <svg
        aria-hidden="true"
        className="dark:hidden"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
      {/* sun — visible in dark mode */}
      <svg
        aria-hidden="true"
        className="hidden dark:block"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
