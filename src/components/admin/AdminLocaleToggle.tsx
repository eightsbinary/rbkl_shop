'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { setAdminLocale } from '@/server/actions/admin-locale';

/** TH/EN switch for the admin UI. Sets the admin_locale cookie then refreshes so
 *  the server re-renders with the chosen language. */
export function AdminLocaleToggle() {
  const current = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  function pick(locale: 'en' | 'th') {
    if (locale === current) return;
    start(async () => {
      await setAdminLocale(locale);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.1em]">
      {(['en', 'th'] as const).map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          aria-pressed={current === l}
          onClick={() => pick(l)}
          className={current === l ? 'text-ink' : 'text-muted transition-colors hover:text-ink'}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
