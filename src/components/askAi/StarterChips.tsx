import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Starter } from '../../lib/askAi/starters';
import type { MentionEntity } from '../../lib/askAi/mentions';
import MentionText from './MentionText';

type StarterChipsProps = {
  starters: Starter[];
  onPick: (starter: Starter, position: number) => void;
  loading?: boolean;
  /** Present in the chat: toggles between the scrolling row and all starters stacked. */
  expanded?: boolean;
  onToggleExpand?: () => void;
  testId?: string;
};

const entitiesOf = (s: Starter): MentionEntity[] =>
  s.films.map((f) => ({ kind: 'film', id: f.id, name: f.title, year: f.year, image: f.posterPath }));

// One slim, horizontally scrolling row of starters. Each chip shows a tiny poster
// next to every film it names.
export default function StarterChips({ starters, onPick, loading, expanded, onToggleExpand, testId = 'ask-ai-chips' }: StarterChipsProps) {
  if (loading) {
    return (
      <div data-testid="ask-ai-chips-loading" className="flex gap-2 overflow-hidden" aria-hidden>
        {[160, 200, 140].map((w) => (
          <div key={w} className="shrink-0 h-11 bg-base-3 border border-line animate-pulse" style={{ width: w }} />
        ))}
      </div>
    );
  }
  if (starters.length === 0) return null;
  return (
    <div className="flex items-start gap-2">
      <div
        data-testid={testId}
        className={expanded ? 'flex-1 min-w-0 flex flex-col gap-1.5' : 'flex-1 min-w-0 flex gap-2 overflow-x-auto no-scrollbar snap-x'}
      >
        {starters.map((s, i) => (
          <button
            key={s.id}
            type="button"
            data-testid="ask-ai-chip"
            data-kind={s.kind}
            onClick={() => onPick(s, i)}
            className={`snap-start min-h-11 px-3 bg-base-3 border border-line text-left text-[13px] text-fg hover:border-fg-3 transition-colors ${
              expanded ? 'w-full py-2 leading-snug' : 'shrink-0 whitespace-nowrap'
            }`}
          >
            <MentionText text={s.text} entities={entitiesOf(s)} />
          </button>
        ))}
      </div>
      {onToggleExpand && starters.length > 1 && (
        <button
          type="button"
          data-testid="ask-ai-expand"
          onClick={onToggleExpand}
          aria-label={expanded ? 'Collapse starters' : 'Show all starters'}
          aria-expanded={!!expanded}
          className="shrink-0 min-h-11 min-w-11 flex items-center justify-center bg-base-3 border border-line text-fg-2 hover:text-fg"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      )}
    </div>
  );
}
