import Link from 'next/link';
import { DiscountForm } from '@/components/admin/DiscountForm';

export default function NewDiscountPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/admin/discounts"
          className="text-sm text-muted transition-colors duration-150 ease-out-soft hover:text-ink"
        >
          ← Discount codes
        </Link>
        <h1 className="font-serif text-3xl text-ink">New code</h1>
      </div>
      <DiscountForm mode="create" />
    </div>
  );
}
