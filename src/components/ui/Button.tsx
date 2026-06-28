import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'solid';
type Size = 'sm' | 'md' | 'lg';

const variantClasses: Record<Variant, string> = {
  primary: 'bg-ink text-paper hover:bg-ink-soft',
  secondary: 'bg-surface text-ink border border-line hover:bg-field',
  ghost: 'bg-transparent text-ink hover:bg-field',
  // Editorial CTAs — square, uppercase, tracked
  outline:
    'rounded-none border border-ink bg-transparent text-ink uppercase tracking-[0.12em] hover:bg-ink hover:text-paper',
  solid: 'rounded-none bg-ink text-paper uppercase tracking-[0.12em] hover:bg-ink-soft',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-base',
  lg: 'h-13 px-7 text-lg',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      className={`inline-flex items-center justify-center rounded-md font-medium tracking-tight transition-all duration-150 ease-out-soft hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:translate-y-0 disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    />
  );
});
