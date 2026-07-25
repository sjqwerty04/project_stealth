import { useState, useEffect } from 'react';
import { callClaude } from '../lib/claude';
import { loadSkill } from '../lib/skills';
import { apiFetch } from '../lib/apiClient';

export function useMovieKnownFor(
  title: string | undefined,
  year: string | undefined,
) {
  const [knownFor, setKnownFor] = useState<string | null>(null);

  useEffect(() => {
    if (!title) return;
    let cancelled = false;
    setKnownFor(null);

    (async () => {
      try {
        // Try the server route first — uses OpenRouter + Gemini 3.1 Flash Lite with real-time web search.
        const params = new URLSearchParams({ title, year: year || '' });
        const res = await apiFetch(`/api/movie-known-for?${params}`);
        const data = res.ok ? await res.json() : { knownFor: null };

        if (!cancelled && data.knownFor) {
          setKnownFor(data.knownFor);
          return;
        }

        // Fallback: call Claude directly via the existing /api/claude proxy.
        // Uses the movie-hook skill for consistent prompt quality.
        const system = loadSkill('movie-hook');
        const prompt = `Write ONE hook line for "${title}"${year ? ` (${year})` : ''}. Max 7 words. Audience-POV. Present tense. Output ONLY the line, no quotes.`;
        const text = await callClaude(prompt, system);
        if (!cancelled && text) {
          setKnownFor(text.trim().replace(/^["'"']|["'"']$/g, ''));
        }
      } catch {
        // silently fail — the line just won't show
      }
    })();

    return () => { cancelled = true; };
  }, [title, year]);

  return { knownFor };
}
