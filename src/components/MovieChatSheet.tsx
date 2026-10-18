import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send, Sparkles } from 'lucide-react';
import SelectsChaseLoader from './ui/SelectsChaseLoader';
import { useMovieChat, type ChatMovie } from '../hooks/useMovieChat';
import type { MovieSnippet } from '../hooks/useMovieInsights';
import type { Starter } from '../lib/askAi/starters';
import BetaBadge from './askAi/BetaBadge';
import StarterChips from './askAi/StarterChips';
import StarterSheet from './askAi/StarterSheet';

type MovieChatSheetProps = {
  open: boolean;
  onClose: () => void;
  movie: ChatMovie;
  snippets: MovieSnippet[];
  taste?: string;
  starters?: Starter[];
  // A starter to auto-send when the sheet opens (picked outside the sheet).
  seedStarter?: Starter | null;
  onSeedConsumed?: () => void;
  /** Opens straight into the expanded starter list. */
  startExpanded?: boolean;
  onStarterPicked?: (starter: Starter, position: number, surface: 'chat-chip' | 'starter-sheet') => void;
  onStartersExpanded?: () => void;
  onTypedQuestion?: () => void;
};

const tmdbImg = (path: string | null) => (path ? `https://image.tmdb.org/t/p/w185${path}` : null);

// Movie-scoped chat that slides up from the bottom. Generic over `movie` so it can
// be mounted on any screen.
export default function MovieChatSheet({
  open,
  onClose,
  movie,
  snippets,
  taste,
  starters = [],
  seedStarter,
  onSeedConsumed,
  startExpanded,
  onStarterPicked,
  onStartersExpanded,
  onTypedQuestion,
}: MovieChatSheetProps) {
  const navigate = useNavigate();
  const { messages, isThinking, send } = useMovieChat(movie, snippets, taste);
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && seedStarter) {
      send(seedStarter.text);
      onSeedConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seedStarter]);

  useEffect(() => {
    if (open) setExpanded(!!startExpanded);
  }, [open, startExpanded]);

  // Keep the transcript pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isThinking]);

  // Starters already asked drop out of the row so it always offers something new.
  const remaining = useMemo(() => {
    const asked = new Set(messages.filter((m) => m.role === 'user').map((m) => m.content));
    return starters.filter((s) => !asked.has(s.text));
  }, [messages, starters]);

  const pick = (starter: Starter, position: number, surface: 'chat-chip' | 'starter-sheet') => {
    onStarterPicked?.(starter, position, surface);
    setExpanded(false);
    send(starter.text);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onTypedQuestion?.();
    send(input);
    setInput('');
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-[75] bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div
        data-testid="ask-ai-chat"
        aria-hidden={!open}
        className={`fixed inset-x-0 bottom-0 z-[80] flex flex-col bg-base border-t border-line shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ height: '82vh' }}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-line">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={16} className="text-select shrink-0" />
            <span className="font-semibold truncate">Ask about {movie.title}</span>
            <BetaBadge />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 flex items-center justify-center text-fg-2 hover:text-fg"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !isThinking && (
            <div className="py-6 text-center">
              <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3 mb-2">Start with a question</p>
              <p className="text-sm text-fg-2 leading-relaxed">
                Plot, meaning, connections, the people behind it, or what to watch next after{' '}
                <span className="text-fg">{movie.title}</span>.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={m.role === 'user' ? 'max-w-[85%]' : 'max-w-[90%] w-full'}>
                <div
                  data-testid={m.role === 'user' ? 'ask-ai-user-msg' : 'ask-ai-reply'}
                  className={`px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user' ? 'bg-fg text-base' : 'bg-base-3 border border-line text-fg'
                  }`}
                >
                  {m.content}
                </div>

                {m.recommendations && m.recommendations.length > 0 && (
                  <div className="flex gap-3 overflow-x-auto mt-3 pb-1 no-scrollbar">
                    {m.recommendations.map((rec) => (
                      <button
                        key={rec.id}
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate(`/movie/${rec.id}?type=movie`);
                        }}
                        className="shrink-0 w-24 text-left group"
                      >
                        <div className="aspect-[2/3] overflow-hidden bg-base-3 group-hover:ring-1 ring-fg-3 transition-all" style={{ borderRadius: 'var(--radius-poster)' }}>
                          {tmdbImg(rec.posterPath) ? (
                            <img src={tmdbImg(rec.posterPath)!} alt={rec.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full" />
                          )}
                        </div>
                        <p className="text-xs text-fg mt-1 line-clamp-2 leading-tight">{rec.title}</p>
                        {rec.year && <p className="font-spec text-[10px] text-fg-3">{rec.year}</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex justify-start">
              <div className="px-4 py-2.5 bg-base-3 border border-line">
                <SelectsChaseLoader size="xs" />
              </div>
            </div>
          )}
        </div>

        {remaining.length > 0 && !isThinking && (
          <div className="px-4 pt-2">
            <StarterChips
              starters={remaining}
              onPick={(s, i) => pick(s, i, 'chat-chip')}
              onExpand={() => {
                onStartersExpanded?.();
                setExpanded(true);
              }}
            />
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask about ${movie.title}…`}
            aria-label={`Ask about ${movie.title}`}
            className="glass-input flex-1 text-sm"
          />
          <button
            type="submit"
            disabled={!input.trim() || isThinking}
            aria-label="Send"
            className="min-h-11 min-w-11 flex items-center justify-center bg-fg text-base disabled:opacity-40 disabled:cursor-not-allowed hover:bg-fg-2 transition-colors"
          >
            <Send size={18} />
          </button>
        </form>

        <StarterSheet
          open={expanded}
          title={movie.title}
          starters={remaining}
          onPick={(s, i) => pick(s, i, 'starter-sheet')}
          onClose={() => setExpanded(false)}
        />
      </div>
    </>
  );
}
