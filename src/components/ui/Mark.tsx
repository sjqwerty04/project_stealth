type MarkProps = {
  size?: number;
  variant?: 'square' | 'icon' | 'lockup';
  className?: string;
};

function Bars({ size }: { size: number }) {
  const barW = size * 0.11;
  const gap = size * 0.055;
  const h = size * 0.82;
  const y = size * 0.09;
  const skew = -13.5;
  const total = 5 * barW + 4 * gap;
  const x0 = (size - total) / 2 + size * 0.06;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      data-testid="mark"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <rect
          key={i}
          x={x0 + i * (barW + gap)}
          y={y}
          width={barW}
          height={h}
          fill={i === 1 ? '#FF3B14' : '#EFEDE9'}
          transform={`skewX(${skew})`}
        />
      ))}
    </svg>
  );
}

export default function Mark({ size = 40, variant = 'square', className = '' }: MarkProps) {
  if (variant === 'lockup') {
    return (
      <div className={`inline-flex items-center gap-3 ${className}`} data-testid="mark-lockup">
        <Bars size={size} />
        <span
          className="font-display font-bold tracking-[0.18em] text-fg uppercase"
          style={{ fontSize: Math.max(14, size * 0.38), letterSpacing: '0.18em' }}
        >
          Selects
        </span>
      </div>
    );
  }
  return (
    <div className={className} style={{ width: size, height: size }} aria-hidden={false}>
      <Bars size={size} />
    </div>
  );
}
