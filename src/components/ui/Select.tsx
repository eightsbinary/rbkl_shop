import { forwardRef, type SelectHTMLAttributes } from 'react';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={`h-11 w-full rounded-none border border-line bg-paper px-3 text-base text-ink transition-[border-color,box-shadow] duration-150 ease-out-soft focus:border-rose focus:shadow-[0_0_0_3px_var(--color-rose-soft)] focus:outline-none ${className}`}
        {...rest}
      >
        {children}
      </select>
    );
  },
);
