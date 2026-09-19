import { useMemo } from 'react';
import { motion } from 'framer-motion';

const MAX_DOTS = 400;
const EMPTY_DOTS = 24;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const SIZE = 300;
const GREY = '#3A3936';

type Props = { count: number; sampled: number; colours: string[] };

type Dot = { x: number; y: number };

function vogel(n: number): Dot[] {
  const c = SIZE / 2;
  const maxR = c - 8;
  const scale = maxR / Math.sqrt(Math.max(n, 1));
  return Array.from({ length: n }, (_, i) => {
    const r = scale * Math.sqrt(i + 0.5);
    const t = i * GOLDEN_ANGLE;
    return { x: c + r * Math.cos(t), y: c + r * Math.sin(t) };
  });
}

export function ReadingDisc({ count, sampled, colours }: Props) {
  const n = count > 0 ? Math.min(count, MAX_DOTS) : EMPTY_DOTS;
  const dots = useMemo(() => vogel(n), [n]);
  // Sampled progress refers to real posters; when the disc is shown at the capped size we scale it to match.
  const filled = count > MAX_DOTS ? Math.round((sampled / count) * n) : sampled;
  const faint = count === 0;
  const dotR = Math.max(1.6, Math.min(3.2, 26 / Math.sqrt(n)));

  return (
    <svg
      data-testid="reading-disc"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width="100%"
      height="100%"
      role="img"
      aria-label={faint ? 'No posters yet' : `${Math.min(filled, n)} of ${n} posters sampled`}
    >
      {dots.map((d, i) => {
        const lit = !faint && i < filled;
        const fill = lit ? colours[i % Math.max(colours.length, 1)] ?? GREY : GREY;
        return (
          <motion.circle
            key={i}
            cx={d.x}
            cy={d.y}
            initial={{ r: dotR * 0.6, fill: GREY, opacity: faint ? 0.25 : 0.45 }}
            animate={{ r: lit ? dotR : dotR * 0.6, fill, opacity: lit ? 1 : faint ? 0.25 : 0.45 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        );
      })}
    </svg>
  );
}

export default ReadingDisc;
