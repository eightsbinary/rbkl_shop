import { cookies } from 'next/headers';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  let locale: string;
  if (hasLocale(routing.locales, requested)) {
    // Storefront — locale comes from the URL ([locale] segment).
    locale = requested;
  } else {
    // No URL locale (the /admin area): use the admin_locale cookie, default English.
    const cookieLocale = (await cookies()).get('admin_locale')?.value;
    locale = hasLocale(routing.locales, cookieLocale) ? cookieLocale : 'en';
  }
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
