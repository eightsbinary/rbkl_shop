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
          <Link
            href="/admin/products"
            className="relative transition-colors duration-150 ease-out-soft after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-200 after:ease-out-soft hover:text-ink hover:after:scale-x-100"
          >
            Products
          </Link>
          <form action={signOutAdmin}>
            <button
              type="submit"
              className="text-muted transition-colors duration-150 ease-out-soft hover:text-ink active:scale-95"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
