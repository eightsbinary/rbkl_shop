import { forwardRef, type SelectHTMLAttributes } from 'react';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={`h-11 w-full rounded-md border border-line bg-paper px-3 text-base text-ink transition-colors duration-150 ease-out-soft focus:outline-none focus:border-rose ${className}`}
        {...rest}
      >
        {children}
      </select>
    );
  },
);
