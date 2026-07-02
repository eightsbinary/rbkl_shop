'use server';

import { cookies } from 'next/headers';
import { routing } from '@/i18n/routing';

/** Persist the admin UI language preference. Scoped to /admin so it never affects
 *  the storefront (which derives its locale from the URL). */
export async function setAdminLocale(locale: string): Promise<void> {
  const value = (routing.locales as readonly string[]).includes(locale) ? locale : 'en';
  (await cookies()).set('admin_locale', value, {
    path: '/admin',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
