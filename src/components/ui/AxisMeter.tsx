import BarUnit from './BarUnit';
import { AXIS_BARS, type AxisScore } from '../../lib/theater';

export default function AxisMeter({
  score,
  className = '',
}: {
  score: AxisScore;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={`${score} of ${AXIS_BARS}`}
      data-testid="axis-meter"
      className={`inline-flex items-center gap-[3px] ${className}`}
    >
      {Array.from({ length: AXIS_BARS }, (_, index) => (
        <BarUnit key={index} state={index < score ? 'on' : 'empty'} width={5} height={14} />
      ))}
    </span>
  );
}
