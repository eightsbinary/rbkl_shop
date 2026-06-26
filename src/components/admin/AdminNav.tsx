import Link from 'next/link';
import { signOutAdmin } from '@/server/actions/auth';

export function AdminNav() {
  return (
    <header className="border-b border-line bg-paper">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <Link href="/admin" className="font-serif text-lg text-ink">
          admin
        </Link>
        <nav className="flex items-center gap-6 text-sm text-ink-soft">
          <Link href="/admin/products" className="hover:text-ink transition-colors">
            Products
          </Link>
          <form action={signOutAdmin}>
            <button type="submit" className="text-muted hover:text-ink transition-colors">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
