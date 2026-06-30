import { forwardRef, type InputHTMLAttributes } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={`h-11 w-full rounded-none border border-line bg-paper px-3 text-base text-ink placeholder:text-muted transition-[border-color,box-shadow] duration-150 ease-out-soft focus:border-rose focus:shadow-[0_0_0_3px_var(--color-rose-soft)] focus:outline-none ${className}`}
        {...rest}
      />
    );
  },
);
