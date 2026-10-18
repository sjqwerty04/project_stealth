import { ChevronUp } from 'lucide-react';
import type { Starter } from '../../lib/askAi/starters';

type StarterChipsProps = {
  starters: Starter[];
  onPick: (starter: Starter, position: number) => void;
  /** Shows the expand control that opens every starter. */
  onExpand?: () => void;
  testId?: string;
};

// Horizontally scrolling starter prompts. The expand control sits first so it is
// reachable without scrolling past every chip.
export default function StarterChips({ starters, onPick, onExpand, testId = 'ask-ai-chips' }: StarterChipsProps) {
  if (starters.length === 0) return null;
  return (
    <div data-testid={testId} className="flex gap-2 overflow-x-auto no-scrollbar snap-x">
      {onExpand && (
        <button
          type="button"
          data-testid="ask-ai-expand"
          onClick={onExpand}
          aria-label="Show more starters"
          className="shrink-0 snap-start min-h-11 min-w-11 flex items-center justify-center bg-base-3 border border-line text-fg-2 hover:text-fg hover:border-fg-3 transition-colors"
        >
          <ChevronUp size={16} />
        </button>
      )}
      {starters.map((s, i) => (
        <button
          key={s.id}
          type="button"
          data-testid="ask-ai-chip"
          data-kind={s.kind}
          onClick={() => onPick(s, i)}
          className="shrink-0 snap-start min-h-11 max-w-[17rem] px-3.5 py-2 bg-base-3 border border-line text-left text-[13px] leading-snug text-fg hover:border-fg-3 transition-colors"
        >
          <span className="line-clamp-2">{s.text}</span>
        </button>
      ))}
    </div>
  );
}
