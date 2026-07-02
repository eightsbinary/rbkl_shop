export function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-sm uppercase tracking-[0.14em] text-ink [&::-webkit-details-marker]:hidden">
        {title}
        <svg
          className="h-3 w-3 transition-transform duration-200 group-open:rotate-180"
          viewBox="0 0 12 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden={true}
        >
          <path d="M1 1.5 6 6.5 11 1.5" />
        </svg>
      </summary>
      <p className="pb-5 text-sm leading-relaxed text-ink-soft">{children}</p>
    </details>
  );
}
