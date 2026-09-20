import BarUnit from './BarUnit';
import { axisMeterName, AXIS_BARS, type AxisScore, type FilmAxisName } from '../../lib/theater';

export default function AxisMeter({
  name,
  score,
  className = '',
}: {
  name: FilmAxisName;
  score: AxisScore;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={axisMeterName(name, score)}
      data-testid="axis-meter"
      className={`inline-flex items-center gap-[3px] ${className}`}
    >
      {Array.from({ length: AXIS_BARS }, (_, index) => (
        <BarUnit key={index} state={index < score ? 'on' : 'empty'} width={5} height={14} />
      ))}
    </span>
  );
}
