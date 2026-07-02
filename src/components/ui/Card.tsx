import type { HTMLAttributes } from 'react';

/** Editorial Mono surface — flat, hairline border on paper-white. Matches the
 *  storefront's login/track panels so the admin reads as the same product. */
export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`border border-line bg-surface p-6 ${className}`} {...rest} />;
}
