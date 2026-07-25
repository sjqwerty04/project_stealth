import { useState, useCallback } from 'react';
import type { MovieSnippet } from './useMovieInsights';
import { apiFetch } from '../lib/apiClient';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const TMDB_BASE = 'https://api.themoviedb.org/3';

export type ChatRec = { id: number; title: string; year: string; posterPath: string | null };
export type ChatMessageUI = {
  role: 'user' | 'assistant';
  content: string;
  recommendations?: ChatRec[];
};

export type ChatMovie = {
  title: string;
  year?: string;
  genres?: string[];
  director?: string | null;
  overview?: string;
};

// Hydrate {title, year} recommendations into TMDB movies (id + poster).
async function hydrate(recs: { title: string; year?: string }[]): Promise<ChatRec[]> {
  const results = await Promise.all(
    recs.slice(0, 8).map(async (r) => {
      try {
        const url = new URL(`${TMDB_BASE}/search/movie`);
        url.searchParams.set('api_key', TMDB_API_KEY);
        url.searchParams.set('query', r.title);
        if (r.year) url.searchParams.set('year', r.year);
        const res = await fetch(url.toString());
        if (!res.ok) return null;
        const data = await res.json();
        const hit = data.results?.[0];
        if (!hit) return null;
        return {
          id: hit.id,
          title: hit.title,
          year: hit.release_date?.slice(0, 4) || r.year || '',
          posterPath: hit.poster_path ?? null,
        } as ChatRec;
      } catch {
        return null;
      }
    })
  );
  return results.filter((r): r is ChatRec => r !== null);
}

export function useMovieChat(movie: ChatMovie, snippets: MovieSnippet[], taste?: string) {
  const [messages, setMessages] = useState<ChatMessageUI[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isThinking) return;

      const userMsg: ChatMessageUI = { role: 'user', content: trimmed };
      const history = [...messages, userMsg];
      setMessages(history);
      setIsThinking(true);

      try {
        const res = await apiFetch('/api/movie-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            movie,
            snippets,
            taste,
          }),
        });
        const data = res.ok ? await res.json() : { text: "Sorry, I couldn't reach the projector booth. Try again?" };
        const recommendations = data.recommendations?.length ? await hydrate(data.recommendations) : undefined;
        setMessages((prev) => [...prev, { role: 'assistant', content: data.text || '', recommendations }]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Something went wrong reaching the chat. Try again?' },
        ]);
      } finally {
        setIsThinking(false);
      }
    },
    [messages, isThinking, movie, snippets, taste]
  );

  const reset = useCallback(() => setMessages([]), []);

  return { messages, isThinking, send, reset };
}
