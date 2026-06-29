export function AboutHero({
  title,
  body1,
  body2,
}: {
  title: string;
  body1: string;
  body2: string;
}) {
  return (
    <section className="container mx-auto grid gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center lg:px-16">
      <div className="max-w-xl space-y-6">
        <h1 className="font-serif text-5xl leading-tight text-ink md:text-6xl">{title}</h1>
        <p className="text-base leading-relaxed text-ink-soft">{body1}</p>
        <p className="text-base leading-relaxed text-ink-soft">{body2}</p>
      </div>
      <div className="aspect-[4/5] w-full bg-field lg:aspect-[3/4]" />
    </section>
  );
}
