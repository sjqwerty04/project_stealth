type BarState = 'empty' | 'on' | 'select' | 'film';

export default function BarUnit({
  state = 'empty',
  className = '',
  width = 8,
  height = 20,
}: {
  state?: BarState;
  className?: string;
  width?: number;
  height?: number;
}) {
  const fill: Record<BarState, string> = {
    empty: 'bg-line',
    on: 'bg-fg',
    select: 'bg-select',
    film: 'bg-film',
  };
  return (
    <span
      data-testid="bar-unit"
      className={`inline-block ${fill[state]} ${className}`}
      style={{ width, height, transform: 'skewX(-13.5deg)' }}
    />
  );
}
