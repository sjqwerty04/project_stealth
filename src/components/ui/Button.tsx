import type { ButtonHTMLAttributes } from 'react';

type Kind = 'primary' | 'secondary' | 'ghost';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: Kind;
  loading?: boolean;
};

export default function Button({
  kind = 'primary',
  loading,
  className = '',
  children,
  disabled,
  ...rest
}: Props) {
  const base =
    'inline-flex items-center justify-center min-h-11 min-w-11 px-4 text-sm font-semibold tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const kinds: Record<Kind, string> = {
    primary: 'bg-fg text-base hover:bg-fg-2',
    secondary: 'bg-base-3 text-fg border border-line hover:border-fg-3',
    ghost: 'bg-transparent text-fg-2 hover:text-fg',
  };
  const { ['data-testid']: testId, ...restProps } = rest as Props & { 'data-testid'?: string };
  return (
    <button
      className={`${base} ${kinds[kind]} ${className}`}
      style={{ borderRadius: 0 }}
      disabled={disabled || loading}
      data-testid={testId ?? (kind === 'primary' ? 'btn-primary' : `btn-${kind}`)}
      {...restProps}
    >
      {loading ? <span className="font-spec text-xs uppercase tracking-widest">Working</span> : children}
    </button>
  );
}
