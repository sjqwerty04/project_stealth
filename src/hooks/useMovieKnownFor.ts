import { useState, useEffect } from 'react';
import { callLlm } from '../lib/llm';
import { loadSkill } from '../lib/skills';
import { apiUrl } from '../lib/apiUrl';

export function useMovieKnownFor(
  title: string | undefined,
  year: string | undefined,
  taste?: string,
) {
  const [knownFor, setKnownFor] = useState<string | null>(null);

  useEffect(() => {
    if (!title) return;
    let cancelled = false;
    setKnownFor(null);

    (async () => {
      try {
        const params = new URLSearchParams({ title, year: year || '' });
        if (taste) params.set('taste', taste.slice(0, 400));
        const res = await fetch(apiUrl(`/api/movie-known-for?${params}`));
        const data = res.ok ? await res.json() : { knownFor: null };

        if (!cancelled && data.knownFor) {
          setKnownFor(data.knownFor);
          return;
        }

        const system = loadSkill('movie-hook');
        const prompt = `Write ONE hook line for "${title}"${year ? ` (${year})` : ''}. Max 7 words. Audience-POV. Present tense. Output ONLY the line, no quotes.${taste ? ` Viewer: ${taste}` : ''}`;
        const text = await callLlm(prompt, system);
        if (!cancelled && text) {
          setKnownFor(text.trim().replace(/^["'"']|["'"']$/g, ''));
        }
      } catch {
        // silently fail — the line just won't show
      }
    })();

    return () => { cancelled = true; };
  }, [title, year, taste]);

  return { knownFor };
}
