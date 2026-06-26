import { forwardRef, type TextareaHTMLAttributes } from 'react';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = '', ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={`min-h-32 w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink placeholder:text-muted transition-colors duration-150 ease-out-soft focus:outline-none focus:border-rose ${className}`}
      {...rest}
    />
  );
});
