import type { LabelHTMLAttributes } from 'react';

export function Label({ className = '', ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: thin wrapper; consumers provide htmlFor + control
    <label className={`text-sm font-medium text-ink-soft ${className}`} {...rest} />
  );
}
