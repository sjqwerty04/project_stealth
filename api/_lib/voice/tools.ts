import type pg from 'pg';
import { addMention, addPicks, addSuggestion, callContext, endCall } from './store.js';

const REACTIONS = new Set(['seen_liked', 'seen_disliked', 'unseen_interested', 'skip']);

type FilmHit = { tmdbId: number | null; year: string | null; posterPath: string | null };

async function tmdbSearch(title: string, year: string | null): Promise<FilmHit> {
  const key = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || '';
  if (!key || key.includes('your_tmdb')) return { tmdbId: null, year, posterPath: null };
  const url = new URL('https://api.themoviedb.org/3/search/movie');
  url.searchParams.set('api_key', key);
  url.searchParams.set('query', title);
  if (year) url.searchParams.set('year', year);
  const res = await fetch(url);
  if (!res.ok) return { tmdbId: null, year, posterPath: null };
  const data = (await res.json()) as { results?: { id?: number; poster_path?: string | null; release_date?: string }[] };
  const hit = data.results?.[0];
  if (!hit?.id) return { tmdbId: null, year, posterPath: null };
  return {
    tmdbId: hit.id,
    year: year || hit.release_date?.slice(0, 4) || null,
    posterPath: hit.poster_path ?? null,
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function runTool(
  client: pg.Client,
  callId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const call = await callContext(client, callId);
  if (!call) return { ok: false, error: 'unknown call' };

  if (name === 'end_call') {
    await endCall(client, call.callId);
    return { ok: true };
  }

  if (name === 'remember_film') {
    const title = text(args.title);
    const liked = args.liked === true;
    const reason = text(args.reason);
    if (!title) return { ok: false, error: 'title is required' };
    if (liked && !reason) {
      return { ok: false, error: 'Ask what they liked about it, then call again with their words in reason.' };
    }
    const film = await tmdbSearch(title, text(args.year) || null);
    await addMention(client, {
      callId: call.callId,
      callerId: call.callerId,
      title,
      year: film.year,
      tmdbId: film.tmdbId,
      liked,
      reason: reason || null,
    });
    return { ok: true, title, liked };
  }

  if (name === 'note_suggestion') {
    const title = text(args.title);
    const reaction = text(args.reaction);
    if (!title || !REACTIONS.has(reaction)) return { ok: false, error: 'title and a known reaction are required' };
    const film = await tmdbSearch(title, text(args.year) || null);
    await addSuggestion(client, {
      callId: call.callId,
      callerId: call.callerId,
      title,
      year: film.year,
      tmdbId: film.tmdbId,
      reaction,
    });
    return { ok: true };
  }

  if (name === 'save_picks') {
    const raw = Array.isArray(args.picks) ? args.picks : [];
    const picks = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const title = text((item as { title?: unknown }).title);
      if (!title) continue;
      const film = await tmdbSearch(title, text((item as { year?: unknown }).year) || null);
      picks.push({ title, year: film.year, tmdbId: film.tmdbId, posterPath: film.posterPath });
    }
    if (!picks.length) return { ok: false, error: 'save at least one title' };
    if (typeof args.sms_opt_in !== 'boolean') return { ok: false, error: 'sms_opt_in must be true or false' };
    await addPicks(client, { callId: call.callId, callerId: call.callerId, picks, smsOptIn: args.sms_opt_in });
    return { ok: true, saved: picks.length, sms_opt_in: args.sms_opt_in, text_sent: false };
  }

  return { ok: false, error: 'unknown tool' };
}
