import { Sparkles } from 'lucide-react';
import type { Starter } from '../lib/askAi/starters';
import StarterChips from './askAi/StarterChips';

type StarterPromptsProps = {
  starters: Starter[];
  onPick: (starter: Starter, position: number) => void;
  onOpen: () => void;
  // Controls the scroll-driven hide/show animation.
  visible: boolean;
};

// Compact Ask AI row that rides above the tab bar while the page scrolls.
// Hidden on scroll-down, revealed on scroll-up (via `visible`).
export default function StarterPrompts({ starters, onPick, onOpen, visible }: StarterPromptsProps) {
  if (starters.length === 0) return null;

  return (
    <div
      data-testid="ask-ai-floating"
      className={`fixed inset-x-0 z-40 pt-8 pb-2 px-4 bg-gradient-to-t from-base via-base/85 to-transparent pointer-events-none transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
      style={{ bottom: 'calc(var(--tab-h) + env(safe-area-inset-bottom))' }}
    >
      <div className={`flex items-center gap-2 ${visible ? 'pointer-events-auto' : ''}`}>
        <button
          type="button"
          onClick={onOpen}
          aria-label="Ask AI"
          className="shrink-0 min-h-11 px-3 flex items-center gap-2 bg-fg text-base"
        >
          <Sparkles size={14} />
          <span className="font-spec text-[10px] uppercase tracking-widest">Ask</span>
        </button>
        <div className="min-w-0 flex-1">
          <StarterChips starters={starters.slice(0, 4)} onPick={onPick} testId="ask-ai-floating-chips" />
        </div>
      </div>
    </div>
  );
}
