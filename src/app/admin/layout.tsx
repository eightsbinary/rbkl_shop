import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
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

  return (
    <div className="min-h-screen bg-paper">
      {!isLoginPage && <AdminNav />}
      <main className={isLoginPage ? '' : 'container mx-auto px-6 py-12'}>{children}</main>
    </div>
  );
}
