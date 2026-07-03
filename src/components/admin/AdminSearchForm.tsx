import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Input } from '@/components/ui/Input';

/** GET search form for admin list pages: input named `q`, submit, and a ✕
 *  back to `clearHref` when a search is active. Pass hidden inputs as children
 *  to preserve other active filters across submits. */
export async function AdminSearchForm({
  action,
  placeholder,
  search,
  clearHref,
  children,
}: {
  action: string;
  placeholder: string;
  search?: string;
  clearHref: string;
  children?: ReactNode;
}) {
  const tc = await getTranslations('admin.common');
  return (
    <form action={action} method="get" className="flex max-w-md items-center gap-3">
      {children}
      <Input
        type="search"
        name="q"
        defaultValue={search ?? ''}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 text-sm"
      />
      <button
        type="submit"
        className="h-10 shrink-0 border border-ink px-4 text-xs uppercase tracking-[0.12em] text-ink transition-colors hover:bg-ink hover:text-paper"
      >
        {tc('searchCta')}
      </button>
      {search && (
        <Link
          href={clearHref}
          aria-label={tc('searchClear')}
          className="shrink-0 text-sm text-muted transition-colors hover:text-ink"
        >
          ✕
        </Link>
      )}
    </form>
  );
}
