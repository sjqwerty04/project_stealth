import { Heart, Minus, X } from 'lucide-react';
import { VERDICTS, VERDICT_LABEL, type Verdict } from '../lib/library';

const ICON: Record<Verdict, typeof Heart> = { liked: Heart, okay: Minus, nope: X };

export const VERDICT_TONE: Record<Verdict, { bg: string; text: string; ring: string }> = {
  liked: { bg: 'bg-green-500', text: 'text-green-400', ring: 'border-green-500' },
  okay: { bg: 'bg-amber-400', text: 'text-amber-300', ring: 'border-amber-400' },
  nope: { bg: 'bg-red-500', text: 'text-red-400', ring: 'border-red-500' },
};

export function VerdictIcon({ verdict, size = 14, className = '' }: { verdict: Verdict; size?: number; className?: string }) {
  const Icon = ICON[verdict];
  return <Icon size={size} className={className} />;
}

/** Small round badge for poster corners and rows. */
export function VerdictBadge({ verdict, size = 20 }: { verdict: Verdict; size?: number }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white shadow ${VERDICT_TONE[verdict].bg}`}
      style={{ width: size, height: size }}
      aria-label={VERDICT_LABEL[verdict]}
      data-testid={`verdict-badge-${verdict}`}
    >
      <VerdictIcon verdict={verdict} size={Math.round(size * 0.55)} className="fill-current" />
    </span>
  );
}

/** Three chips: Liked, It's okay, Nope. */
export default function VerdictPicker({
  value,
  onChange,
  disabled = false,
  size = 'md',
}: {
  value: Verdict | null;
  onChange: (verdict: Verdict) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const pad = size === 'lg' ? 'p-4' : size === 'sm' ? 'py-2 px-3' : 'p-3';
  const iconSize = size === 'lg' ? 28 : size === 'sm' ? 14 : 20;
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Verdict" data-testid="verdict-picker">
      {VERDICTS.map((v) => {
        const active = value === v;
        const tone = VERDICT_TONE[v];
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={`verdict-${v}`}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`flex flex-col items-center justify-center gap-1 min-h-11 ${pad} border-2 transition-all disabled:opacity-50 ${
              active ? `${tone.ring} ${tone.text} bg-base-3` : 'border-line bg-base-2 text-fg-3 hover:text-fg-2'
            }`}
            style={{ borderRadius: 0 }}
          >
            <VerdictIcon verdict={v} size={iconSize} className={active ? 'fill-current' : ''} />
            <span className={`font-bold ${size === 'sm' ? 'text-[10px]' : 'text-xs'}`}>{VERDICT_LABEL[v]}</span>
          </button>
        );
      })}
    </div>
  );
}
