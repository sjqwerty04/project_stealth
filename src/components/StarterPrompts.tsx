import { MessageCircle } from 'lucide-react';

type StarterPromptsProps = {
  questions: string[];
  onAsk: (question: string) => void;
  // Controls the scroll-driven hide/show animation.
  visible: boolean;
};

// Floating question chips surfaced from Reddit discussion, pinned above the bottom
// of the screen. Hidden on scroll-down, revealed on scroll-up (via `visible`).
export default function StarterPrompts({ questions, onAsk, visible }: StarterPromptsProps) {
  if (questions.length === 0) return null;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8 px-4 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
    >
      <div className="flex gap-2 overflow-x-auto no-scrollbar pointer-events-auto">
        {questions.map((q, i) => (
          <button
            key={i}
            onClick={() => onAsk(q)}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-gray-800/90 backdrop-blur-sm border border-gray-700 text-sm text-gray-100 hover:bg-gray-700 hover:border-purple-500/50 transition-colors shadow-lg"
          >
            <MessageCircle size={14} className="text-purple-400 shrink-0" />
            <span className="whitespace-nowrap">{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
