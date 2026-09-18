import { historyScore } from '../library/verdict';
import { buildRecommendContext, withCompact } from './buildRecommendContext';
import { HISTORY_LIMIT, PREFERENCE_LIMIT, type TasteEvent, type TasteSnapshot } from './types';

function uniqPref(list: string[], value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return list;
  if (list.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return list;
  return [trimmed, ...list].slice(0, PREFERENCE_LIMIT);
}

function dropPref(list: string[], title: string): string[] {
  const lower = title.toLowerCase();
  return list.filter((p) => {
    const q = p.toLowerCase();
    return q !== lower && q !== `dislikes: ${lower}` && q !== `something like ${lower}`;
  });
}

function prependHistory(snapshot: TasteSnapshot, title: string, rating: number, movieId?: number): TasteSnapshot {
  const next = snapshot.context.history.filter((h) => h.item.toLowerCase() !== title.toLowerCase());
  next.unshift({
    item: title,
    rating,
    ...(movieId != null ? { id: String(movieId) } : {}),
  });
  return {
    ...snapshot,
    context: { ...snapshot.context, history: next.slice(0, HISTORY_LIMIT) },
  };
}

function dropHistory(snapshot: TasteSnapshot, title: string): TasteSnapshot {
  return {
    ...snapshot,
    context: {
      ...snapshot.context,
      history: snapshot.context.history.filter((h) => h.item.toLowerCase() !== title.toLowerCase()),
    },
  };
}

export function applyTasteEvent(snapshot: TasteSnapshot, event: TasteEvent, eventId: string): TasteSnapshot {
  let next: TasteSnapshot = {
    ...snapshot,
    pointers: { ...snapshot.pointers, lastEventId: eventId },
  };

  switch (event.type) {
    case 'onboarding': {
      next = {
        ...next,
        identity: {
          personaLine: event.personaLine ?? next.identity.personaLine,
          axis: event.axis,
        },
      };
      const context = buildRecommendContext({
        identity: next.identity,
        favorites: event.favoriteFilms,
        disliked: event.dislikedFilms,
        rated: [
          ...event.favoriteFilms.map((f) => ({ ...f, verdict: 'liked' as const })),
          ...event.dislikedFilms.map((f) => ({ ...f, verdict: 'nope' as const })),
        ],
        watchlist: [],
        skipped: [],
        searches: [],
        patterns: next.generated.patterns,
      });
      next = { ...next, context };
      break;
    }
    case 'verdict': {
      const score = historyScore(event.verdict, event.stars);
      if (score != null) next = prependHistory(next, event.title, score, event.movieId);
      let preferences = dropPref(next.context.preferences, event.title);
      if (event.verdict === 'liked') preferences = uniqPref(preferences, event.title);
      if (event.verdict === 'nope') preferences = uniqPref(preferences, `dislikes: ${event.title}`);
      next = { ...next, context: { ...next.context, preferences } };
      break;
    }
    case 'watched_remove': {
      next = dropHistory(next, event.title);
      next = {
        ...next,
        context: { ...next.context, preferences: dropPref(next.context.preferences, event.title) },
      };
      break;
    }
    case 'skip': {
      next = {
        ...next,
        context: {
          ...next.context,
          preferences: uniqPref(next.context.preferences, `dislikes: ${event.title}`),
        },
      };
      break;
    }
    case 'watchlist_add': {
      next = {
        ...next,
        context: {
          ...next.context,
          preferences: uniqPref(next.context.preferences, `something like ${event.title}`),
        },
      };
      break;
    }
    case 'watchlist_remove':
      break;
    case 'calendar_log': {
      const score = historyScore(event.verdict ?? null, event.stars);
      if (score != null) next = prependHistory(next, event.title, score, event.movieId);
      break;
    }
    case 'search': {
      next = {
        ...next,
        context: {
          ...next.context,
          preferences: uniqPref(next.context.preferences, `something like ${event.query}`),
        },
      };
      break;
    }
    case 'import': {
      const digest = event.digest;
      if (!digest) break;
      for (const film of [...digest.recent].reverse()) {
        next = prependHistory(next, film.title, 3, film.movieId);
      }
      for (const film of [...digest.rejects].reverse()) {
        next = prependHistory(next, film.title, 1, film.movieId);
      }
      for (const film of [...digest.canon].reverse()) {
        next = prependHistory(next, film.title, 5, film.movieId);
      }
      let preferences = next.context.preferences;
      for (const film of digest.canon.slice(0, 6)) preferences = uniqPref(preferences, film.title);
      for (const film of digest.rejects.slice(0, 5)) preferences = uniqPref(preferences, `dislikes: ${film.title}`);
      next = { ...next, context: { ...next.context, preferences } };
      break;
    }
    case 'movie_viewed':
    case 'chat_turn':
    case 'orbit_swipe':
      break;
    case 'pattern': {
      const patterns = [event.insight, ...next.generated.patterns.filter((p) => p !== event.insight)].slice(0, 8);
      next = { ...next, generated: { ...next.generated, patterns } };
      break;
    }
    case 'identity': {
      next = {
        ...next,
        identity: { ...next.identity, personaLine: event.personaLine },
        generated: {
          ...next.generated,
          insightCards: event.insightCards ?? next.generated.insightCards,
        },
        context: { ...next.context, profile: event.personaLine },
      };
      break;
    }
    case 'last_picks': {
      next = {
        ...next,
        generated: {
          ...next.generated,
          lastPicks: event.picks,
          lastPicksAt: Date.now(),
        },
      };
      break;
    }
    default: {
      const _never: never = event;
      return _never;
    }
  }

  return withCompact(next);
}

export function shouldRebuildDiary(event: TasteEvent): boolean {
  switch (event.type) {
    case 'movie_viewed':
    case 'chat_turn':
    case 'last_picks':
    case 'identity':
    case 'pattern':
      return false;
    default:
      return true;
  }
}
