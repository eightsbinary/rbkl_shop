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
    <section className="relative h-[80vh] min-h-[560px] w-full overflow-hidden bg-ink-deep">
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={imageAlt}
          fill
          priority
          className="object-cover object-[center_25%]"
          sizes="100vw"
        />
      )}
      {/* Subtle overlay (matches Figma — light, just for text legibility) */}
      <div className="absolute inset-0 bg-black/10" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center text-paper-fixed [text-shadow:0_1px_3px_rgba(0,0,0,0.3)]">
        <h1 className="max-w-3xl font-serif text-5xl leading-tight tracking-tight md:text-6xl">
          {title}
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper-fixed/90">{subtitle}</p>
        <Link href={`/${locale}/shop`} className="mt-10">
          <Button variant="solid" size="md">
            {cta}
          </Button>
        </Link>
      </div>
    </section>
  );
}
