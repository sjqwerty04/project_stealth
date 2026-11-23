import { MessageCircle } from 'lucide-react';

type StarterPromptsProps = {
  questions: string[];
  onAsk: (question: string) => void;
  visible: boolean;
  embedded?: boolean;
};

// Floating question chips surfaced from Reddit discussion, pinned above the bottom
// of the screen. Hidden on scroll-down, revealed on scroll-up (via `visible`).
export default function StarterPrompts({ questions, onAsk, visible, embedded = false }: StarterPromptsProps) {
  if (questions.length === 0) return null;

  return (
    <div
      className={`${embedded ? 'relative' : 'pointer-events-none fixed inset-x-0 z-40 mx-auto w-full max-w-[480px]'} bg-base px-3 pb-1 pt-2 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-6'
      }`}
      style={embedded ? undefined : { bottom: 'calc(76px + env(safe-area-inset-bottom))' }}
    >
      <div className="flex gap-2 overflow-x-auto no-scrollbar pointer-events-auto">
        {questions.map((q, i) => (
          <button
            key={i}
            onClick={() => onAsk(q)}
            className="flex min-h-11 shrink-0 items-center gap-1.5 border border-line bg-base-2/95 px-3 py-2 text-sm text-fg"
          >
            <MessageCircle size={14} className="shrink-0 text-fg-3" />
            <span className="whitespace-nowrap">{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
