import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send, Loader2, Sparkles } from 'lucide-react';
import { useMovieChat, type ChatMovie } from '../hooks/useMovieChat';
import type { MovieSnippet } from '../hooks/useMovieInsights';
import { imageUrlOrNull } from '../lib/tmdb';

type MovieChatSheetProps = {
  open: boolean;
  onClose: () => void;
  movie: ChatMovie;
  snippets: MovieSnippet[];
  taste?: string;
  // A question to auto-send when the sheet opens (from a starter prompt).
  seedQuestion?: string | null;
  onSeedConsumed?: () => void;
};

const tmdbImg = (path: string | null) => imageUrlOrNull(path, 'w185');

// Movie-scoped chat that slides up from the bottom. Generic over `movie` so it can
// be mounted on any screen.
export default function MovieChatSheet({
  open,
  onClose,
  movie,
  snippets,
  taste,
  seedQuestion,
  onSeedConsumed,
}: MovieChatSheetProps) {
  const navigate = useNavigate();
  const { messages, isThinking, send } = useMovieChat(movie, snippets, taste);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-send a starter-prompt question when opened with one.
  useEffect(() => {
    if (open && seedQuestion) {
      send(seedQuestion);
      onSeedConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seedQuestion]);

  // Keep the transcript pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
    setInput('');
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 flex flex-col bg-gray-950 border-t border-gray-800 rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ height: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-800">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={16} className="text-purple-400 shrink-0" />
            <span className="font-semibold truncate">Ask about {movie.title}</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-800 transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Transcript */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !isThinking && (
            <p className="text-center text-gray-500 text-sm py-8">
              Ask anything about <span className="text-gray-300">{movie.title}</span> — plot, trivia, theories, or
              "show me more like this but…"
            </p>
          )}

          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={m.role === 'user' ? 'max-w-[85%]' : 'max-w-[90%] w-full'}>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-purple-600 text-white rounded-br-md'
                      : 'bg-gray-800 text-gray-100 rounded-bl-md'
                  }`}
                >
                  {m.content}
                </div>

                {/* Hydrated recommendations */}
                {m.recommendations && m.recommendations.length > 0 && (
                  <div className="flex gap-3 overflow-x-auto mt-3 pb-1 no-scrollbar">
                    {m.recommendations.map((rec) => (
                      <button
                        key={rec.id}
                        onClick={() => {
                          onClose();
                          navigate(`/movie/${rec.id}?type=movie`);
                        }}
                        className="shrink-0 w-24 text-left group"
                      >
                        <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 group-hover:ring-2 ring-purple-500 transition-all">
                          {tmdbImg(rec.posterPath) ? (
                            <img src={tmdbImg(rec.posterPath)!} alt={rec.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full" />
                          )}
                        </div>
                        <p className="text-xs text-gray-200 mt-1 line-clamp-2 leading-tight">{rec.title}</p>
                        {rec.year && <p className="text-[10px] text-gray-500">{rec.year}</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex justify-start">
              <div className="px-4 py-2.5 rounded-2xl bg-gray-800 text-gray-400 rounded-bl-md">
                <Loader2 size={16} className="animate-spin" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3 border-t border-gray-800 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask about ${movie.title}…`}
            className="flex-1 px-4 py-2.5 rounded-full bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isThinking}
            className="p-2.5 rounded-full bg-purple-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-500 transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </>
  );
}
