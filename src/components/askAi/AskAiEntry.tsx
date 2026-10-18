import type { Starter } from '../../lib/askAi/starters';
import BetaBadge from './BetaBadge';
import StarterChips from './StarterChips';

type AskAiEntryProps = {
  starters: Starter[];
  loading: boolean;
  onPick: (starter: Starter, position: number) => void;
};

// The page's only starter row: a one-line label and the film's chips.
export default function AskAiEntry({ starters, loading, onPick }: AskAiEntryProps) {
  if (!loading && starters.length === 0) return null;
  return (
    <section data-testid="ask-ai-entry" className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3">Ask AI</p>
        <BetaBadge />
      </div>
      <StarterChips starters={starters} loading={loading} onPick={onPick} testId="ask-ai-entry-chips" />
    </section>
  );
}
