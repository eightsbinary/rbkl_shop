import Image from 'next/image';

export function InspirationSection({
  label,
  title,
  body1,
  body2,
}: {
  label: string;
  title: string;
  body1: string;
  body2: string;
}) {
  return (
    <section className="container mx-auto grid gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center lg:px-16">
      <div className="relative aspect-square w-full overflow-hidden bg-ink-deep">
        <Image
          src="/about-inspiration.png"
          alt=""
          fill
          className="object-cover"
          sizes="(min-width: 1024px) 50vw, 100vw"
        />
      </div>
      <div className="max-w-xl space-y-5">
        <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
        <h2 className="font-serif text-3xl text-ink md:text-4xl">{title}</h2>
        <p className="text-base leading-relaxed text-ink-soft">{body1}</p>
        <p className="text-base leading-relaxed text-ink-soft">{body2}</p>
      </div>
    </section>
  );
}
