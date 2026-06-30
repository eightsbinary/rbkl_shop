'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

/** Editorial "Journal" band. Phase 1 stub: captures the email locally and shows a
 *  thank-you; no backend wiring yet (no newsletter service exists). */
export function NewsletterBand({
  title,
  subtitle,
  placeholder,
  cta,
  thanks,
}: {
  title: string;
  subtitle: string;
  placeholder: string;
  cta: string;
  thanks: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <section className="bg-ink-deep px-6 py-24 text-center text-paper">
      <div className="mx-auto max-w-xl space-y-5">
        <h2 className="font-serif text-3xl">{title}</h2>
        <p className="text-sm text-paper/70">{subtitle}</p>
        {done ? (
          <p className="text-sm text-paper/90">{thanks}</p>
        ) : (
          <form
            className="flex items-center justify-center gap-0"
            onSubmit={(e) => {
              e.preventDefault();
              setDone(true); // TODO(newsletter-backend): POST to a real list when one exists.
            }}
          >
            <input
              type="email"
              required
              placeholder={placeholder}
              className="h-12 w-64 border border-paper/30 bg-transparent px-4 text-sm text-paper placeholder:text-paper/40 focus:border-paper focus:outline-none"
            />
            <Button type="submit" variant="solid-paper" size="md">
              {cta}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
