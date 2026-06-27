'use client';

import { useEffect, useState } from 'react';
import { useCart } from '@/lib/cart-store';

export function CartIcon({ label }: { label: string }) {
  const count = useCart((s) => s.count());
  const setOpen = useCart((s) => s.setOpen);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors duration-150 ease-out-soft hover:text-ink"
      aria-label="Open cart"
    >
      <span>{label}</span>
      {mounted && count > 0 && (
        // `key={count}` remounts the badge on each change so it re-pops.
        <span
          key={count}
          className="animate-pop inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1.5 text-xs leading-none text-paper tabular-nums"
        >
          {count}
        </span>
      )}
    </button>
  );
}
