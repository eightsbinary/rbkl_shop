import { forwardRef, type TextareaHTMLAttributes } from 'react';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = '', ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={`min-h-32 w-full rounded-none border border-line bg-paper px-3 py-2 text-base text-ink placeholder:text-muted transition-[border-color,box-shadow] duration-150 ease-out-soft focus:border-rose focus:shadow-[0_0_0_3px_var(--color-rose-soft)] focus:outline-none ${className}`}
      {...rest}
    />
  );
});
