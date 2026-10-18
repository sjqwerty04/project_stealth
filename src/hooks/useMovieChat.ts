import { useState, useCallback, useRef } from 'react';
import type { MovieSnippet } from './useMovieInsights';
import { useAuth } from './useAuth';
import { recordTasteEvent } from '../lib/taste';
import type { MentionEntity } from '../lib/askAi/mentions';
import { noEmDash } from '../lib/askAi/starters';
import { prefetchStarters } from './useAskAiStarters';

export type ChatMessageUI = {
  role: 'user' | 'assistant';
  content: string;
  entities?: MentionEntity[];
  streaming?: boolean;
};

export type ChatMovie = {
  id?: number;
  title: string;
  year?: string;
  genres?: string[];
  director?: string | null;
  overview?: string;
};

const FAILED = "Couldn't reach the projector booth. Try again?";

export function useMovieChat(movie: ChatMovie, snippets: MovieSnippet[], taste?: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessageUI[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const busy = useRef(false);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy.current) return;
      busy.current = true;

      const history = [...messages, { role: 'user' as const, content: trimmed }];
      setMessages([...history, { role: 'assistant', content: '', streaming: true }]);
      setIsThinking(true);
      const patchLast = (patch: Partial<ChatMessageUI>) =>
        setMessages((prev) => [...prev.slice(0, -1), { ...prev[prev.length - 1], ...patch }]);

      try {
        const res = await fetch('/api/movie-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            movie,
            snippets,
            taste,
            stream: true,
          }),
        });
        if (!res.ok || !res.body) throw new Error(`chat ${res.status}`);

        if (!(res.headers.get('content-type') || '').includes('ndjson')) {
          const data = await res.json();
          patchLast({ content: noEmDash(data.text || FAILED), entities: data.entities || [], streaming: false });
        } else {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let content = '';
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let nl: number;
            while ((nl = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, nl).trim();
              buffer = buffer.slice(nl + 1);
              if (!line) continue;
              const ev = JSON.parse(line);
              if (ev.t === 'd') {
                content += ev.v;
                setIsThinking(false);
                patchLast({ content });
              } else if (ev.t === 'done') {
                const entities: MentionEntity[] = ev.entities || [];
                patchLast({ content: ev.text || content, entities, streaming: false });
                entities.forEach((e) => e.kind === 'film' && prefetchStarters(e.id));
              } else if (ev.t === 'error') {
                patchLast({ content: content || FAILED, streaming: false });
              }
            }
          }
          patchLast({ streaming: false });
        }
        if (user?.uid && movie.id) {
          void recordTasteEvent(user.uid, { type: 'chat_turn', movieId: movie.id, title: movie.title }, { email: user.email });
        }
      } catch {
        patchLast({ content: FAILED, streaming: false });
      } finally {
        busy.current = false;
        setIsThinking(false);
      }
    },
    [messages, movie, snippets, taste, user],
  );

  const reset = useCallback(() => setMessages([]), []);

  return { messages, isThinking, send, reset };
}
