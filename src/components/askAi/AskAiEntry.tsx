import { Sparkles, ArrowUpRight } from 'lucide-react';
import type { Starter } from '../../lib/askAi/starters';
import BetaBadge from './BetaBadge';
import StarterChips from './StarterChips';

type AskAiEntryProps = {
  title: string;
  knownFor?: string | null;
  starters: Starter[];
  onOpen: () => void;
  onPick: (starter: Starter, position: number) => void;
  onExpand: () => void;
};

// "About this film" block: the Ask AI entry point plus the film's top starters.
export default function AskAiEntry({ title, knownFor, starters, onOpen, onPick, onExpand }: AskAiEntryProps) {
  return (
    <section data-testid="ask-ai-entry" className="bg-base-2 border border-line">
      <div className="px-4 pt-4">
        <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3">About this film</p>
        {knownFor && <p className="mt-2 text-sm text-fg-2 leading-relaxed">{knownFor}</p>}
      </div>
      <button
        type="button"
        data-testid="ask-ai-open"
        onClick={onOpen}
        className="w-full mt-3 px-4 min-h-12 flex items-center gap-2.5 text-left border-t border-line hover:bg-base-3 transition-colors"
      >
        <Sparkles size={16} className="text-select shrink-0" />
        <span className="flex-1 min-w-0 truncate text-sm font-semibold text-fg">Ask AI about {title}</span>
        <BetaBadge />
        <ArrowUpRight size={16} className="text-fg-3 shrink-0" />
      </button>
      <div className="px-4 pb-4 pt-1">
        <StarterChips starters={starters.slice(0, 3)} onPick={onPick} onExpand={onExpand} testId="ask-ai-entry-chips" />
      </div>
    </section>
  );
}
