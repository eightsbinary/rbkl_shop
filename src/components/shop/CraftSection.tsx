import Image from 'next/image';

export function CraftSection({
  title,
  subtitle,
  caption,
  card1Title,
  card1Body,
  card2Title,
  card2Body,
}: {
  title: string;
  subtitle: string;
  caption: string;
  card1Title: string;
  card1Body: string;
  card2Title: string;
  card2Body: string;
}) {
  return (
    <section className="container mx-auto space-y-12 px-6 py-20 lg:px-16">
      <div className="mx-auto max-w-2xl space-y-3 text-center">
        <h2 className="font-serif text-3xl text-ink md:text-4xl">{title}</h2>
        <p className="text-sm leading-relaxed text-muted">{subtitle}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-field">
          <Image
            src="/about-craft.png"
            alt=""
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 66vw, 100vw"
          />
          <span className="absolute bottom-4 left-4 z-10 bg-ink-deep px-3 py-1 text-xs uppercase tracking-[0.12em] text-paper">
            {caption}
          </span>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
          {[
            { t: card1Title, b: card1Body },
            { t: card2Title, b: card2Body },
          ].map((c) => (
            <div key={c.t} className="space-y-3 border border-line bg-surface p-6">
              <div className="h-6 w-6 border border-ink" aria-hidden={true} />
              <h3 className="font-serif text-xl text-ink">{c.t}</h3>
              <p className="text-sm leading-relaxed text-ink-soft">{c.b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
