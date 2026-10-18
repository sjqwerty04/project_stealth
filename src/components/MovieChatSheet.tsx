import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Send, Sparkles } from 'lucide-react';
import SelectsChaseLoader from './ui/SelectsChaseLoader';
import { useMovieChat, type ChatMovie } from '../hooks/useMovieChat';
import type { MovieSnippet } from '../hooks/useMovieInsights';
import type { Starter } from '../lib/askAi/starters';
import { unmentioned, type MentionEntity } from '../lib/askAi/mentions';
import BetaBadge from './askAi/BetaBadge';
import StarterChips from './askAi/StarterChips';
import MentionText, { EntityThumb } from './askAi/MentionText';

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
  onStarterPicked?: (starter: Starter, position: number) => void;
  onStartersExpanded?: () => void;
  onTypedQuestion?: () => void;
  onOpenEntity: (entity: MentionEntity) => void;
};

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
  onStarterPicked,
  onStartersExpanded,
  onTypedQuestion,
  onOpenEntity,
}: MovieChatSheetProps) {
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
    if (!open) setExpanded(false);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isThinking]);

  // Starters already asked drop out of the row so it always offers something new.
  const remaining = useMemo(() => {
    const asked = new Set(messages.filter((m) => m.role === 'user').map((m) => m.content));
    return starters.filter((s) => !asked.has(s.text));
  }, [messages, starters]);

  const streaming = messages.some((m) => m.streaming);

  const pick = (starter: Starter, position: number) => {
    onStarterPicked?.(starter, position);
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
        style={{ height: '78vh' }}
      >
        <div className="flex items-center justify-between px-4 pt-2 pb-1.5 border-b border-line">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={15} className="text-select shrink-0" />
            <span className="font-semibold text-sm truncate">Ask about {movie.title}</span>
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

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <p className="py-6 text-center text-sm text-fg-3">Ask anything about {movie.title}.</p>
          )}

          {messages.map((m, i) => {
            if (m.role === 'user') {
              return (
                <div key={i} className="flex justify-end">
                  <div data-testid="ask-ai-user-msg" className="max-w-[85%] px-3.5 py-2 bg-fg text-base text-sm leading-relaxed">
                    {m.content}
                  </div>
                </div>
              );
            }
            if (!m.content && m.streaming) {
              return (
                <div key={i} data-testid="ask-ai-thinking" className="inline-flex px-3.5 py-2.5 bg-base-3 border border-line">
                  <SelectsChaseLoader size="xs" />
                </div>
              );
            }
            const entities = m.entities || [];
            const extra = m.streaming ? [] : unmentioned(m.content, entities);
            return (
              <div key={i} className="max-w-[92%]">
                <div
                  data-testid="ask-ai-reply"
                  className="px-3.5 py-2.5 bg-base-3 border border-line text-sm leading-relaxed text-fg"
                >
                  <MentionText text={m.content} entities={entities} onOpen={onOpenEntity} />
                  {m.streaming && <span data-testid="ask-ai-streaming" className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-fg-3 animate-pulse" />}
                </div>
                {extra.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-1.5">
                    {extra.map((e) => (
                      <button
                        key={`${e.kind}-${e.id}`}
                        type="button"
                        data-testid={`mention-${e.kind}`}
                        data-entity-id={e.id}
                        onClick={() => onOpenEntity(e)}
                        className="shrink-0 min-h-11 px-2.5 inline-flex items-center gap-1.5 bg-base-2 border border-line text-xs text-fg-2 hover:text-fg"
                      >
                        <EntityThumb entity={e} size="md" />
                        <span className="whitespace-nowrap">{e.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {remaining.length > 0 && !streaming && (
          <div className="px-4 pt-2">
            <StarterChips
              starters={remaining}
              onPick={pick}
              expanded={expanded}
              onToggleExpand={() => {
                if (!expanded) onStartersExpanded?.();
                setExpanded(!expanded);
              }}
            />
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
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
            disabled={!input.trim() || streaming}
            aria-label="Send"
            className="min-h-11 min-w-11 flex items-center justify-center bg-fg text-base disabled:opacity-40 disabled:cursor-not-allowed hover:bg-fg-2 transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </>
  );
}
