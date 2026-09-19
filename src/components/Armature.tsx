import { motion } from 'framer-motion';
import type { Step } from '../lib/onboarding/state';

type Bar = { x: number; y: number; h: number; rotate: number; lit: boolean; opacity?: number };

const GENTLE = { duration: 1.2, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

const ROW = (lit: number[], h = 80, y = 20, gap = 18, x0 = 40): Bar[] =>
  Array.from({ length: 5 }, (_, i) => ({ x: x0 + i * gap, y, h, rotate: 0, lit: lit.includes(i) }));

/**
 * The same five bars on every screen. Only position, rotation, and light change,
 * so the graphic never changes shape, it moves.
 */
const POSES: Record<Step, Bar[]> = {
  splash: ROW([2]),
  positive: ROW([2], 60, 30, 26, 32),
  negative: [
    { x: 32, y: 30, h: 60, rotate: 0, lit: false },
    { x: 58, y: 30, h: 60, rotate: 0, lit: false },
    { x: 84, y: 30, h: 60, rotate: -38, lit: true },
    { x: 110, y: 30, h: 60, rotate: 0, lit: false },
    { x: 136, y: 30, h: 60, rotate: 0, lit: false },
  ],
  neutral: ROW([1, 2, 3], 60, 30, 26, 32),
  import: ROW([2], 40, 40, 14, 62),
  reading: [
    { x: 78, y: 50, h: 20, rotate: 0, lit: false, opacity: 0 },
    { x: 84, y: 50, h: 20, rotate: 72, lit: false, opacity: 0 },
    { x: 90, y: 50, h: 20, rotate: 144, lit: true, opacity: 0 },
    { x: 96, y: 50, h: 20, rotate: 216, lit: false, opacity: 0 },
    { x: 102, y: 50, h: 20, rotate: 288, lit: false, opacity: 0 },
  ],
  negativeProfile: ROW([2], 14, 8, 10, 6).map((b) => ({ ...b, opacity: 0.85 })),
  insights: ROW([0, 1, 2, 3, 4], 14, 8, 10, 6).map((b, i) => ({ ...b, lit: i < 3 })),
};

export default function Armature({ step, className = '' }: { step: Step; className?: string }) {
  const bars = POSES[step];
  const compact = step === 'negativeProfile' || step === 'insights';
  return (
    <div
      aria-hidden
      data-testid="armature"
      data-step={step}
      className={`relative mx-auto ${compact ? 'h-[30px] w-[80px]' : 'h-[120px] w-[180px]'} ${className}`}
      style={{ transition: 'height 1.2s cubic-bezier(0.22,1,0.36,1), width 1.2s cubic-bezier(0.22,1,0.36,1)' }}
    >
      {bars.map((b, i) => (
        <motion.div
          key={i}
          className="absolute top-0 left-0 w-[10px] origin-center"
          initial={false}
          animate={{
            x: b.x,
            y: b.y,
            height: b.h,
            rotate: b.rotate,
            opacity: b.opacity ?? 1,
            backgroundColor: b.lit ? '#FF3B14' : '#EFEDE9',
            skewX: -13.5,
          }}
          transition={GENTLE}
        />
      ))}
    </div>
  );
}
