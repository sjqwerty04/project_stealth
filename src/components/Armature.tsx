type ArmatureState = 'mark' | 'screen' | 'broken' | 'fan' | 'stack';

const LAYOUTS: Record<ArmatureState, { x: number; y: number; h: number }[]> = {
  mark: [
    { x: 40, y: 20, h: 80 },
    { x: 58, y: 20, h: 80 },
    { x: 76, y: 20, h: 80 },
    { x: 94, y: 20, h: 80 },
    { x: 112, y: 20, h: 80 },
  ],
  screen: [
    { x: 20, y: 30, h: 60 },
    { x: 50, y: 18, h: 84 },
    { x: 80, y: 10, h: 100 },
    { x: 110, y: 18, h: 84 },
    { x: 140, y: 30, h: 60 },
  ],
  broken: [
    { x: 16, y: 10, h: 50 },
    { x: 48, y: 40, h: 70 },
    { x: 84, y: 16, h: 90 },
    { x: 118, y: 48, h: 52 },
    { x: 148, y: 22, h: 78 },
  ],
  fan: [
    { x: 20, y: 50, h: 40 },
    { x: 52, y: 30, h: 70 },
    { x: 84, y: 12, h: 96 },
    { x: 116, y: 30, h: 70 },
    { x: 148, y: 50, h: 40 },
  ],
  stack: [
    { x: 70, y: 16, h: 88 },
    { x: 78, y: 20, h: 80 },
    { x: 86, y: 24, h: 72 },
    { x: 94, y: 28, h: 64 },
    { x: 102, y: 32, h: 56 },
  ],
};

export default function Armature({ state = 'mark' }: { state?: ArmatureState }) {
  const bars = LAYOUTS[state];
  return (
    <svg viewBox="0 0 180 120" className="w-full max-w-[330px] mx-auto" aria-hidden data-testid="armature">
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width={10}
          height={b.h}
          fill="#EFEDE9"
          transform="skewX(-13.5)"
        />
      ))}
    </svg>
  );
}
