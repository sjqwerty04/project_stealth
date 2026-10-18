import { X, ArrowUpRight } from 'lucide-react';
import type { Starter, StarterKind } from '../../lib/askAi/starters';

const KIND_LABEL: Record<StarterKind, string> = {
  faq: 'Most asked',
  compare: 'Compare',
  related: 'Connections',
  meaning: 'Meaning',
  theme: 'Themes',
  director: 'Director',
  cast: 'Cast',
  'more-like': 'Build a list',
  before: 'Before you watch',
  ending: 'Spoilers',
};

type StarterSheetProps = {
  open: boolean;
  title: string;
  starters: Starter[];
  onPick: (starter: Starter, position: number) => void;
  onClose: () => void;
};

// The expanded view of every starter, layered over the chat.
export default function StarterSheet({ open, title, starters, onPick, onClose }: StarterSheetProps) {
  if (!open) return null;
  return (
    <div data-testid="ask-ai-starter-sheet" className="absolute inset-0 z-10 flex flex-col bg-base">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-line">
        <div className="min-w-0">
          <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3">Starters</p>
          <p className="font-semibold text-fg truncate">Ask about {title}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 min-w-11 flex items-center justify-center text-fg-2 hover:text-fg"
          aria-label="Close starters"
        >
          <X size={18} />
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto divide-y divide-line">
        {starters.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              data-testid="ask-ai-sheet-item"
              onClick={() => onPick(s, i)}
              className="w-full min-h-14 px-4 py-3 flex items-center gap-3 text-left hover:bg-base-2 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-spec text-[9px] uppercase tracking-widest text-fg-3 mb-1">{KIND_LABEL[s.kind]}</p>
                <p className="text-sm text-fg leading-snug">{s.text}</p>
              </div>
              <ArrowUpRight size={16} className="text-fg-3 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
