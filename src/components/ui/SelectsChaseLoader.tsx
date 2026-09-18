import React from 'react';

export type ChaseLoaderSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CONFIG: Record<
  ChaseLoaderSize,
  { height: number; barWidth: number; gap: number; textClass: string }
> = {
  xs: { height: 12, barWidth: 2, gap: 2, textClass: 'text-[10px]' },
  sm: { height: 14, barWidth: 2.5, gap: 2.5, textClass: 'text-xs' },
  md: { height: 18, barWidth: 3, gap: 3, textClass: 'text-sm' },
  lg: { height: 28, barWidth: 4.5, gap: 4.5, textClass: 'text-base' },
  xl: { height: 40, barWidth: 6, gap: 6, textClass: 'text-lg' },
};

export interface SelectsChaseLoaderProps {
  size?: ChaseLoaderSize;
  label?: string;
  className?: string;
  barClassName?: string;
  idleColor?: string;
  activeColor?: string;
  center?: boolean;
}

export default function SelectsChaseLoader({
  size = 'md',
  label,
  className = '',
  barClassName = '',
  idleColor,
  activeColor,
  center = false,
}: SelectsChaseLoaderProps) {
  const config = SIZE_CONFIG[size] || SIZE_CONFIG.md;

  const content = (
    <div
      role="status"
      aria-label={label || 'Loading'}
      className={`inline-flex items-center gap-3 ${className}`}
      data-testid="selects-chase-loader"
    >
      <span
        className="selects-chase-mark"
        style={
          {
            height: `${config.height}px`,
            gap: `${config.gap}px`,
            '--chase-idle': idleColor,
            '--chase-active': activeColor,
          } as React.CSSProperties
        }
        aria-hidden="true"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`selects-chase-bar ${barClassName}`}
            style={
              {
                width: `${config.barWidth}px`,
                height: `${config.height}px`,
                '--i': i,
              } as React.CSSProperties
            }
          />
        ))}
      </span>
      {label && (
        <span
          className={`font-spec uppercase tracking-wider text-fg-2 ${config.textClass}`}
          data-testid="selects-chase-label"
        >
          {label}
        </span>
      )}
    </div>
  );

  if (center) {
    return (
      <div className="flex items-center justify-center w-full h-full p-4">
        {content}
      </div>
    );
  }

  return content;
}
