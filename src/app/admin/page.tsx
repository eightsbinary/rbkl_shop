import Link from 'next/link';

export default function AdminHome() {
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl text-ink">Welcome.</h1>
      <p className="text-ink-soft">
        Start with{' '}
        <Link href="/admin/products" className="underline">
          Products
        </Link>
        .
      </p>
    </div>
  );
}
