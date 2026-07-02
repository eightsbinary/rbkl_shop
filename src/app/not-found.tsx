import Link from 'next/link';

/**
 * Root not-found fallback for unmatched top-level paths and invalid locales
 * (LocaleLayout calls notFound() above the locale segment). Renders inside the
 * root layout, so globals.css and the theme classes are available — but there is
 * no locale context here, so the copy is English.
 */
export default function NotFound() {
  return (
    <section className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">error 404</p>
      <h1 className="mt-4 font-serif text-4xl text-ink lg:text-5xl">Page not found</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
        The page you are looking for does not exist or has moved.
      </p>
      <Link
        href="/"
        className="mt-8 border border-ink px-6 py-3 text-xs uppercase tracking-[0.12em] text-ink transition-colors hover:bg-ink hover:text-paper"
      >
        Back to home
      </Link>
    </section>
  );
}
