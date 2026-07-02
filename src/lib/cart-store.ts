'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartLine {
  variantId: string;
  qty: number;
}

interface CartState {
  lines: CartLine[];
  open: boolean;
  setOpen(open: boolean): void;
  add(line: CartLine): void;
  setQty(variantId: string, qty: number): void;
  remove(variantId: string): void;
  clear(): void;
  count(): number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      open: false,
      setOpen: (open) => set({ open }),
      add: ({ variantId, qty }) =>
        set((s) => {
          const existing = s.lines.find((l) => l.variantId === variantId);
          if (existing) {
            return {
              lines: s.lines.map((l) =>
                l.variantId === variantId ? { ...l, qty: l.qty + qty } : l,
              ),
            };
          }
          return { lines: [...s.lines, { variantId, qty }] };
        }),
      setQty: (variantId, qty) =>
        set((s) => ({
          lines:
            qty <= 0
              ? s.lines.filter((l) => l.variantId !== variantId)
              : s.lines.map((l) => (l.variantId === variantId ? { ...l, qty } : l)),
        })),
      remove: (variantId) =>
        set((s) => ({ lines: s.lines.filter((l) => l.variantId !== variantId) })),
      clear: () => set({ lines: [] }),
      count: () => get().lines.reduce((acc, l) => acc + l.qty, 0),
    }),
    {
      name: 'rb_shop_cart',
      // Persist only the cart lines — never the transient `open` drawer flag.
      partialize: (s) => ({ lines: s.lines }),
      // Force the drawer closed on every load, even for sessions whose older
      // persisted state still contains `open: true`.
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<CartState>),
        open: false,
      }),
    },
  ),
);
