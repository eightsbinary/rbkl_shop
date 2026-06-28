import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export function Hero({
  locale,
  title,
  subtitle,
  cta,
  imageUrl,
  imageAlt,
}: {
  locale: 'th' | 'en';
  title: string;
  subtitle: string;
  cta: string;
  imageUrl: string | null;
  imageAlt: string;
}) {
  return (
    <section className="relative h-[70vh] min-h-[480px] w-full overflow-hidden bg-ink-deep">
      {imageUrl && (
        <Image src={imageUrl} alt={imageAlt} fill priority className="object-cover" sizes="100vw" />
      )}
      <div className="absolute inset-0 bg-ink-deep/35" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-6 px-6 text-center text-paper">
        <h1 className="max-w-3xl font-serif text-4xl leading-tight md:text-6xl">{title}</h1>
        <p className="max-w-md text-sm text-paper/80">{subtitle}</p>
        <Link href={`/${locale}/shop`}>
          <Button
            variant="outline"
            size="md"
            className="border-paper text-paper hover:bg-paper hover:text-ink"
          >
            {cta}
          </Button>
        </Link>
      </div>
    </section>
  );
}
