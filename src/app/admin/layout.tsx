import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { AdminNav } from '@/components/admin/AdminNav';
import { getCurrentRole } from '@/db/auth';
import { createServerSupabase } from '@/db/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get('x-pathname') ?? '';
  const isLoginPage = pathname.startsWith('/admin/login');

  if (!isLoginPage) {
    const supa = await createServerSupabase();
    const role = await getCurrentRole(supa);
    if (role !== 'owner' && role !== 'dev') {
      redirect('/admin/login');
    }
  }

  // Admin lives outside [locale]; its locale comes from the admin_locale cookie
  // (see src/i18n/request.ts). Provide it to client components in the subtree.
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="min-h-screen bg-paper">
        {!isLoginPage && <AdminNav />}
        <main className={isLoginPage ? '' : 'container mx-auto px-6 py-12'}>{children}</main>
      </div>
    </NextIntlClientProvider>
  );
}
