type BarState = 'empty' | 'on' | 'select' | 'film';

export default function BarUnit({
  state = 'empty',
  className = '',
}: {
  state?: BarState;
  className?: string;
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
      style={{ width: 8, height: 20, transform: 'skewX(-13.5deg)' }}
    />
  );
}
