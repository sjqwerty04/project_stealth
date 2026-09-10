import { buildRecommendContext, ratingToHistoryScore, withCompact } from './buildRecommendContext';
import { HISTORY_LIMIT, PREFERENCE_LIMIT, type TasteEvent, type TasteSnapshot } from './types';

function uniqPref(list: string[], value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return list;
  if (list.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return list;
  return [trimmed, ...list].slice(0, PREFERENCE_LIMIT);
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
          ...event.favoriteFilms.map((f) => ({ ...f, rating: 'up' as const })),
          ...event.dislikedFilms.map((f) => ({ ...f, rating: 'down' as const })),
        ],
        watchlist: [],
        skipped: [],
        searches: [],
        patterns: next.generated.patterns,
      });
      next = { ...next, context };
      break;
    }
    case 'rate': {
      const score = ratingToHistoryScore(event.rating);
      if (score != null) next = prependHistory(next, event.title, score, event.movieId);
      if (event.rating === 'up') {
        next = {
          ...next,
          context: { ...next.context, preferences: uniqPref(next.context.preferences, event.title) },
        };
      } else {
        next = {
          ...next,
          context: {
            ...next.context,
            preferences: uniqPref(next.context.preferences, `dislikes: ${event.title}`),
          },
        };
      }
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
      const score = ratingToHistoryScore(event.rating);
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
    case 'movie_viewed':
    case 'chat_turn':
    case 'orbit_swipe':
    case 'import':
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
