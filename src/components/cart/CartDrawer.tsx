'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useCart } from '@/lib/cart-store';
import { CartContents } from './CartContents';

export function CartDrawer() {
  const open = useCart((s) => s.open);
  const setOpen = useCart((s) => s.setOpen);
  const t = useTranslations('cart');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  return (
    <>
      <button
        type="button"
        aria-label="Close cart"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-ink/30 transition-opacity duration-220 ease-out-soft ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        aria-label={t('title')}
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col bg-paper p-6 shadow-xl transition-transform duration-260 ease-out-soft ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-center justify-between pb-4">
          <h2 className="font-serif text-2xl text-ink">{t('title')}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-muted hover:text-ink"
            aria-label="Close cart"
          >
            ×
          </button>
        </header>
        <div className="flex-1 overflow-hidden">
          <CartContents />
        </div>
      </aside>
    </>
  );
}
