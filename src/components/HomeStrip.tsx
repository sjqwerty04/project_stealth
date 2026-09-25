import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, differenceInCalendarDays, format, isSameDay, parseISO, startOfDay, subDays, subYears } from 'date-fns';
import type { CalendarEvent } from '../hooks/useCalendarLogs';
import { useRecommendation, type SelectSlotId } from '../hooks/useRecommendation';
import { eventsWithWatchDates } from '../lib/filmNights';
import { eventDayKey, stripFill } from '../lib/stripDays';
import SelectsCarousel, { type FilmArt, type SelectFilm } from './SelectsCarousel';
import { carouselArtIdsStillNeeded, relatedFromWhy, relatedPosterPool } from './selectsCarouselLogic';
import { dayStageKey, isSelectsDismissTarget, parseAppDateParam, showSelectsSkeleton } from './homeStripLogic';
import { Mark } from './ui';
import Skeleton from './ui/Skeleton';
import DiaryDaySheet from './DiaryDaySheet';
import { useLibrary } from '../lib/library';
import { useProfileFilms } from '../hooks/useProfileFilms';
import FeedbackFAB from './FeedbackFAB';
import { VerdictBadge } from './VerdictPicker';
import { eventVerdict } from '../hooks/useCalendarLogs';

export type { SelectFilm };

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const TMDB_API_KEY =
  !TMDB_KEY || TMDB_KEY.includes('your_tmdb') ? '' : TMDB_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';

function dayKey(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

function tmdbImage(path: string | null | undefined, size: 'w500' | 'w780' = 'w780') {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

async function loadFilmArt(film: SelectFilm): Promise<FilmArt> {
  const fallbackStill = tmdbImage(film.backdrop) || film.poster;
  const fallbackLogo = film.logo ?? null;
  try {
    const api = await fetch(
      `/api/movie-images?id=${film.id}&type=${film.mediaType === 'tv' ? 'tv' : 'movie'}`,
    );
    if (api.ok) {
      const data = await api.json();
      if (data?.logo || data?.still) {
        return {
          logo: data.logo || fallbackLogo,
          still: data.still || fallbackStill,
        };
      }
    }
  } catch {
    /* local vite has no /api */
  }
  if (!TMDB_API_KEY || !film.id) return { logo: fallbackLogo, still: fallbackStill };
  try {
    const mediaType = film.mediaType === 'tv' ? 'tv' : 'movie';
    const url = new URL(`${TMDB_BASE}/${mediaType}/${film.id}/images`);
    url.searchParams.set('api_key', TMDB_API_KEY);
    url.searchParams.set('include_image_language', 'en,null');
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('images');
    const data = await res.json();
    const logos: { file_path?: string; iso_639_1?: string | null }[] = data?.logos ?? [];
    const pngs = logos.filter((logo) => logo.file_path?.endsWith('.png'));
    const pool = pngs.length ? pngs : logos;
    const preferred =
      pool.find((logo) => logo.iso_639_1 === 'en') ||
      pool.find((logo) => !logo.iso_639_1) ||
      pool[0];
    const stillPath = data?.stills?.[0]?.file_path || data?.backdrops?.[0]?.file_path || null;
    return {
      logo: preferred?.file_path ? tmdbImage(preferred.file_path, 'w500') : fallbackLogo,
      still: stillPath ? tmdbImage(stillPath, 'w780') : fallbackStill,
    };
  } catch {
    return { logo: fallbackLogo, still: fallbackStill };
  }
}

function useCarouselArt(films: SelectFilm[]) {
  const [art, setArt] = useState<Record<number, FilmArt>>({});
  const artRef = useRef(art);
  artRef.current = art;
  const pendingRef = useRef(new Set<number>());
  const filmsRef = useRef(films);
  filmsRef.current = films;
  const ids = films.map((film) => film.id).join(',');
  const idsRef = useRef(ids);
  idsRef.current = ids;

  useEffect(() => {
    const wanted = filmsRef.current;
    const missing = carouselArtIdsStillNeeded(
      [...Object.keys(artRef.current).map(Number), ...pendingRef.current],
      wanted.map((film) => film.id),
    );
    const byId = new Map(wanted.map((film) => [film.id, film]));
    for (const id of missing) {
      const film = byId.get(id);
      if (!film) continue;
      pendingRef.current.add(id);
      void loadFilmArt(film).then((row) => {
        pendingRef.current.delete(id);
        const stillWanted = idsRef.current.split(',').filter(Boolean).map(Number);
        if (!stillWanted.includes(id)) return;
        setArt((prev) => (prev[id] ? prev : { ...prev, [id]: row }));
      });
    }
  }, [ids]);

  return art;
}

type DayClip = { key: string | null; logo: string | null; still: string | null };

const clipCache = new Map<string, DayClip>();

function pickTrailer(
  videos: { type?: string; site?: string; official?: boolean; key?: string }[],
) {
  const yt = videos.filter((v) => v.site === 'YouTube' && v.key);
  return (
    yt.find((v) => v.type === 'Trailer' && v.official) ||
    yt.find((v) => v.type === 'Trailer') ||
    yt.find((v) => v.type === 'Teaser') ||
    yt[0] ||
    null
  );
}

function useDayClip(film: CalendarEvent | null) {
  const [clip, setClip] = useState<DayClip | null>(null);

  useEffect(() => {
    if (!film) {
      setClip(null);
      return;
    }
    const cacheKey = `${film.mediaType === 'tv' ? 'tv' : 'movie'}:${film.movieId}`;
    const cached = clipCache.get(cacheKey);
    if (cached) {
      setClip(cached);
      return;
    }

    let cancelled = false;
    const fallback: DayClip = {
      key: null,
      logo: null,
      still: tmdbImage(film.backdrop) || film.poster,
    };

    const load = async () => {
      try {
        const api = await fetch(
          `/api/movie-clip?id=${film.movieId}&type=${film.mediaType === 'tv' ? 'tv' : 'movie'}`,
        );
        if (api.ok) {
          const data = await api.json();
          const next: DayClip = {
            key: data.key || null,
            logo: data.logo || null,
            still: data.still || fallback.still,
          };
          clipCache.set(cacheKey, next);
          if (!cancelled) setClip(next);
          return;
        }
      } catch {
        /* local vite has no /api */
      }
      if (!TMDB_API_KEY || !film.movieId) {
        try {
          const images = await fetch(
            `/api/movie-images?id=${film.movieId}&type=${film.mediaType === 'tv' ? 'tv' : 'movie'}`,
          );
          if (images.ok) {
            const data = await images.json();
            const next: DayClip = {
              key: null,
              logo: data.logo || null,
              still: data.still || fallback.still,
            };
            if (next.logo || next.still) clipCache.set(cacheKey, next);
            if (!cancelled) setClip(next);
            return;
          }
        } catch {
          /* ignore */
        }
        clipCache.set(cacheKey, fallback);
        if (!cancelled) setClip(fallback);
        return;
      }
      try {
        const mediaType = film.mediaType === 'tv' ? 'tv' : 'movie';
        const videosUrl = new URL(`${TMDB_BASE}/${mediaType}/${film.movieId}/videos`);
        videosUrl.searchParams.set('api_key', TMDB_API_KEY);
        const imagesUrl = new URL(`${TMDB_BASE}/${mediaType}/${film.movieId}/images`);
        imagesUrl.searchParams.set('api_key', TMDB_API_KEY);
        imagesUrl.searchParams.set('include_image_language', 'en,null');
        const [videosRes, imagesRes] = await Promise.all([
          fetch(videosUrl.toString()),
          fetch(imagesUrl.toString()),
        ]);
        const videosData = videosRes.ok ? await videosRes.json() : { results: [] };
        const imagesData = imagesRes.ok ? await imagesRes.json() : {};
        const trailer = pickTrailer(videosData.results || []);
        const logos: { file_path?: string; iso_639_1?: string | null }[] = imagesData?.logos ?? [];
        const pngs = logos.filter((logo) => logo.file_path?.endsWith('.png'));
        const pool = pngs.length ? pngs : logos;
        const preferred =
          pool.find((logo) => logo.iso_639_1 === 'en') ||
          pool.find((logo) => !logo.iso_639_1) ||
          pool[0];
        const next: DayClip = {
          key: trailer?.key ?? null,
          logo: preferred?.file_path ? tmdbImage(preferred.file_path, 'w500') : null,
          still: tmdbImage(imagesData?.backdrops?.[0]?.file_path) || fallback.still,
        };
        clipCache.set(cacheKey, next);
        if (!cancelled) setClip(next);
      } catch {
        clipCache.set(cacheKey, fallback);
        if (!cancelled) setClip(fallback);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [film?.movieId, film?.mediaType, film?.backdrop, film?.poster]);

  return clip;
}

function DayStage({
  film,
  onOpen,
  watchCount = 0,
  verdict,
  stageKey,
}: {
  film: CalendarEvent;
  onOpen: () => void;
  watchCount?: number;
  verdict?: ReturnType<typeof eventVerdict>;
  stageKey: string;
}) {
  const clip = useDayClip(film);
  const shownVerdict = verdict ?? eventVerdict(film);
  const still = clip?.still || film.backdrop || film.poster;
  const logo = clip?.logo;

  return (
    <div
      data-testid="day-stage"
      data-stage-key={stageKey}
      className="absolute inset-0 overflow-hidden bg-black min-h-11"
      style={{ containerType: 'size' }}
    >
      {clip?.key ? (
        <iframe
          key={clip.key}
          data-testid="day-stage-iframe"
          data-clip-key={clip.key}
          title=""
          src={`https://www.youtube-nocookie.com/embed/${clip.key}?autoplay=1&mute=1&controls=0&loop=1&playlist=${clip.key}&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0`}
          allow="autoplay; encrypted-media"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            border: 'none',
            width: 'max(100cqw, calc(100cqh * 16 / 9))',
            height: 'max(100cqh, calc(100cqw * 9 / 16))',
          }}
        />
      ) : (
        still && (
          <img src={still} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )
      )}
      <span className="absolute inset-0 bg-black/30 pointer-events-none" />
      <span className="absolute inset-0 z-10 flex items-center justify-center px-8 pointer-events-none">
        {logo ? (
          <img
            src={logo}
            alt=""
            className="max-h-[28%] max-w-[70%] object-contain"
            style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,.85))' }}
          />
        ) : (
          <span className="font-display font-extrabold text-fg text-2xl tracking-tight text-center leading-none">
            {film.title}
          </span>
        )}
      </span>
      <span className="absolute top-2 right-2 z-10 flex items-center gap-1.5 pointer-events-none">
        {watchCount > 1 && (
          <span className="px-1.5 py-0.5 bg-black/70 font-spec text-[10px] uppercase tracking-widest text-fg" data-testid="day-stage-count">
            x{watchCount}
          </span>
        )}
        {shownVerdict && <VerdictBadge verdict={shownVerdict} size={18} />}
      </span>
      <button
        type="button"
        aria-label={film.title}
        onClick={onOpen}
        className="absolute inset-0 z-20 min-h-11"
      />
    </div>
  );
}

export default function HomeStrip({
  events,
  insightsLabel,
  onYearZoom,
  onOpenMovie,
  onOpenProfile,
  onAddMovie,
}: {
  events: CalendarEvent[];
  insightsLabel?: string | null;
  onYearZoom: () => void;
  onOpenMovie: (id: number, mediaType?: string, whyMatch?: string) => void;
  onOpenProfile?: () => void;
  onAddMovie: (date: Date) => void;
}) {
  const [searchParams] = useSearchParams();
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [stageOpen, setStageOpen] = useState(true);
  const [daySheet, setDaySheet] = useState<Date | null>(null);
  const {
    picks,
    status,
    replacements,
    replaceSelect,
    retrySelectReplacement,
  } = useRecommendation({ events });
  const { byId: library, films: libraryFilms } = useLibrary();
  const profilePicks = useProfileFilms();
  const stripTrackRef = useRef<HTMLDivElement | null>(null);
  const nights = useMemo(() => eventsWithWatchDates(events, libraryFilms), [events, libraryFilms]);

  // Span from the earliest logged night (floored at five years) to sixty days ahead.
  const earliest = useMemo(() => {
    let min: string | null = null;
    for (const e of nights) {
      const k = eventDayKey(e.date);
      if (k && (!min || k < min)) min = k;
    }
    return min;
  }, [nights]);
  const days = useMemo(() => {
    const today = startOfDay(new Date());
    const floor = subYears(today, 5);
    let start = subDays(today, 180);
    if (earliest) {
      const first = startOfDay(parseISO(earliest));
      if (first < start) start = first < floor ? floor : first;
    }
    const count = differenceInCalendarDays(today, start) + 60 + 1;
    return Array.from({ length: count }, (_, i) => addDays(start, i));
  }, [earliest]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of nights) {
      const k = eventDayKey(e.date);
      if (!k) continue;
      const list = map.get(k) ?? [];
      list.push(e);
      map.set(k, list);
    }
    return map;
  }, [nights]);

  const dayLogs = byDay.get(dayKey(selected)) ?? [];
  const dayFilm = dayLogs[0] ?? null;
  const yearCount = nights.filter((e) =>
    eventDayKey(e.date).startsWith(String(selected.getFullYear())),
  ).length;

  const posterPool = useMemo(
    () => relatedPosterPool(libraryFilms, profilePicks, nights),
    [libraryFilms, profilePicks, nights],
  );

  const slides = useMemo(() => {
    return picks.slice(0, 3).map((p, slotId) => ({
      slotId: slotId as SelectSlotId,
      id: p.movieId,
      title: p.title,
      poster: p.poster,
      backdrop: p.backdrop,
      mediaType: p.mediaType,
      year: p.year,
      runtime: p.runtime,
      whyMatch: p.reason,
      related: relatedFromWhy(p.reason, posterPool, p.title),
    }));
  }, [picks, posterPool]);

  const art = useCarouselArt(slides);
  const dateParam = searchParams.get('date');

  useEffect(() => {
    const parsed = parseAppDateParam(dateParam);
    if (!parsed) return;
    setSelected(parsed);
    setStageOpen(true);
  }, [dateParam]);

  useEffect(() => {
    const track = stripTrackRef.current;
    if (!track) return;
    const active = track.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!active) return;
    const nextLeft = active.offsetLeft - track.clientWidth + active.offsetWidth;
    track.scrollTo({ left: Math.max(0, nextLeft), behavior: 'instant' });
  }, []);

  return (
    <div
      className="bg-base text-fg flex flex-1 min-h-0 flex-col overflow-hidden"
      data-testid="home-strip"
      data-build={import.meta.env.VITE_SELECTS_SHA || 'unknown'}
    >
      <header className="px-7 pt-6 pb-4 flex items-start justify-between shrink-0">
        <Mark variant="lockup" size={36} />
        <div className="flex items-start gap-2">
          <FeedbackFAB variant="inline" />
          <button
            type="button"
            data-testid="year-zoom"
            onClick={onYearZoom}
            className="min-h-11 min-w-11 px-3 font-spec text-[10px] uppercase tracking-widest text-fg-2 border border-line"
          >
            Year
          </button>
        </div>
      </header>

      {insightsLabel && (
        <button
          type="button"
          onClick={onOpenProfile}
          className="px-7 font-spec text-[10px] uppercase tracking-widest text-fg-3 mb-4 text-left shrink-0"
          data-testid="insights-label"
        >
          {insightsLabel}
        </button>
      )}

      <div
        className="px-7 flex-1 min-h-0 overflow-y-auto"
        data-testid="selects-scroll"
        onClick={(event) => {
          if (!isSelectsDismissTarget(event.target)) return;
          setStageOpen(false);
        }}
      >
        <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3 mb-3">your selects</p>
        {showSelectsSkeleton(status, slides.length) && (
          <div data-testid="selects-skeleton">
            <Skeleton className="w-full h-[220px]" />
          </div>
        )}
        {status === 'empty' && (
          <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3 pb-4" data-testid="selects-empty">
            Log a film to get Your Selects.
          </p>
        )}
        {status === 'error' && (
          <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3 pb-4" data-testid="selects-error">
            Could not load Your Selects.
          </p>
        )}
        {slides.length > 0 && (
          <SelectsCarousel
            slides={slides}
            art={art}
            onOpenMovie={onOpenMovie}
            replacements={replacements}
            onVerdict={(slotId, verdict) => {
              void replaceSelect(slotId, verdict);
            }}
            onRetry={(slotId) => {
              void retrySelectReplacement(slotId);
            }}
          />
        )}
        {stageOpen && dayFilm ? (
          <div
            className="relative mt-4 overflow-hidden"
            style={{ height: '28vh', maxHeight: 220, minHeight: 140 }}
          >
            <DayStage
              key={dayStageKey(selected, dayFilm.movieId)}
              stageKey={dayStageKey(selected, dayFilm.movieId)}
              film={dayFilm}
              watchCount={library.get(dayFilm.movieId)?.watchCount ?? 0}
              verdict={library.get(dayFilm.movieId)?.verdict ?? eventVerdict(dayFilm)}
              onOpen={() => (dayLogs.length > 1 ? setDaySheet(selected) : onOpenMovie(dayFilm.movieId, dayFilm.mediaType))}
            />
          </div>
        ) : null}
        <div className="min-h-11" data-testid="selects-dismiss" />
      </div>

      <div className="shrink-0 bg-base pt-3" data-testid="strip-dock">
        {dayFilm ? (
          <button
            type="button"
            data-testid="day-caption"
            onClick={() => setDaySheet(selected)}
            className="px-7 mb-2 text-left font-spec text-[10px] uppercase tracking-widest text-fg-3 min-h-11"
          >
            {format(selected, 'EEEE d')}
            {'  ·  '}
            {dayLogs.length > 1 ? `${dayLogs.length} films` : yearCount + ' this year'}
          </button>
        ) : (
          <button
            type="button"
            data-testid="ticket-slot-empty"
            onClick={() => onAddMovie(selected)}
            className="px-7 mb-2 text-left font-spec text-[10px] uppercase tracking-widest text-fg-3 min-h-11"
          >
            {format(selected, 'EEEE d')}
            {'  ·  '}
            {yearCount} this year
          </button>
        )}

        <div
          ref={stripTrackRef}
          className="relative z-10 px-7 overflow-x-auto overflow-y-hidden no-scrollbar pb-3"
          data-testid="strip-track"
        >
          <div className="flex w-max gap-1 pb-2">
            {days.map((d) => {
              const logs = byDay.get(dayKey(d)) ?? [];
              const film = logs[0];
              const active = isSameDay(d, selected);
              const color = stripFill(film?.accentStart, logs.length > 0);
              return (
                <button
                  key={dayKey(d)}
                  data-testid={`strip-day-${format(d, 'd')}`}
                  aria-label={film ? format(d, 'EEEE MMM d') : `Log a film on ${format(d, 'EEEE MMM d')}`}
                  aria-pressed={active}
                  onClick={() => {
                    if (film && active) {
                      setDaySheet(d);
                      return;
                    }
                    setSelected(d);
                    setStageOpen(true);
                    if (!film) onAddMovie(d);
                  }}
                  className="relative flex shrink-0 flex-col items-center gap-0.5 w-6 min-h-11"
                >
                  {logs.length > 1 && (
                    <span
                      className="absolute -top-1 right-0 w-1.5 h-1.5 rounded-full bg-fg"
                      data-testid="strip-day-multi"
                      aria-hidden
                    />
                  )}
                  <span
                    className="block shrink-0"
                    style={{
                      width: 12,
                      minWidth: 12,
                      height: 44,
                      transform: 'skewX(-13.5deg)',
                      backgroundColor: color.startsWith('var(') ? undefined : color,
                      background: color,
                      outline: active ? '1px solid var(--fg)' : 'none',
                      outlineOffset: 1,
                    }}
                  />
                  <span className="font-spec text-[9px] text-fg-3 leading-none">{format(d, 'd')}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <DiaryDaySheet
        date={daySheet}
        logs={daySheet ? byDay.get(dayKey(daySheet)) ?? [] : []}
        library={library}
        onClose={() => setDaySheet(null)}
        onOpenMovie={(id, type) => {
          setDaySheet(null);
          onOpenMovie(id, type);
        }}
        onAddMovie={(d) => {
          setDaySheet(null);
          onAddMovie(d);
        }}
      />
    </div>
  );
}
