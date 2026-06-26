import { forwardRef, type InputHTMLAttributes } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={`h-11 w-full rounded-md border border-line bg-paper px-3 text-base text-ink placeholder:text-muted transition-colors duration-150 ease-out-soft focus:outline-none focus:border-rose ${className}`}
        {...rest}
      />
    );
  },
);
