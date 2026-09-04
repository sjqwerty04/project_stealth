import type { InputHTMLAttributes } from 'react';

export default function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      data-testid="input"
      className={`w-full min-h-11 px-3 bg-base-2 border border-line text-fg placeholder:text-fg-3 focus:outline-none focus:border-fg-2 ${className}`}
      style={{ borderRadius: 0 }}
      {...rest}
    />
  );
}
