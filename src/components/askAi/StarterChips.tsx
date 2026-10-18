import type { Starter } from '../../lib/askAi/starters';
import type { MentionEntity } from '../../lib/askAi/mentions';
import MentionText from './MentionText';

type StarterChipsProps = {
  starters: Starter[];
  onPick: (starter: Starter, position: number) => void;
  loading?: boolean;
  testId?: string;
};

const entitiesOf = (s: Starter): MentionEntity[] =>
  s.films.map((f) => ({ kind: 'film', id: f.id, name: f.title, year: f.year, image: f.posterPath }));

// One slim, horizontally scrolling row of starters. Each chip shows a tiny poster
// next to every film it names.
export default function StarterChips({ starters, onPick, loading, testId = 'ask-ai-chips' }: StarterChipsProps) {
  if (loading) {
    return (
      <div data-testid="ask-ai-chips-loading" className="flex gap-2 overflow-hidden" aria-hidden>
        {[160, 200, 140].map((w) => (
          <div key={w} className="shrink-0 h-8 bg-base-3 border border-line animate-pulse" style={{ width: w }} />
        ))}
      </div>
    );
  }
  if (starters.length === 0) return null;
  return (
    <div data-testid={testId} className="flex gap-2 overflow-x-auto no-scrollbar snap-x">
      {starters.map((s, i) => (
        <button
          key={s.id}
          type="button"
          data-testid="ask-ai-chip"
          data-kind={s.kind}
          onClick={() => onPick(s, i)}
          className="snap-start shrink-0 whitespace-nowrap min-h-11 px-2.5 bg-base-3 border border-line text-left text-[13px] text-fg hover:border-fg-3 transition-colors"
        >
          <MentionText text={s.text} entities={entitiesOf(s)} />
        </button>
      ))}
    </div>
  );
}
