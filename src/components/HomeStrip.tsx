import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, isSameDay, startOfDay, subDays } from 'date-fns';
import type { CalendarEvent } from '../hooks/useCalendarLogs';
import { useRecommendation } from '../hooks/useRecommendation';
import { eventDayKey, stripFill } from '../lib/stripDays';
import { firstSentence } from '../lib/taste';
import { loopingSlides, snapLoopIndex } from './selectsCarousel';
import { Mark } from './ui';
import Skeleton from './ui/Skeleton';

export type SelectFilm = {
  id: number;
  title: string;
  poster: string;
  backdrop?: string;
  logo?: string;
  mediaType?: 'movie' | 'tv';
  year?: number | string;
  runtime?: string;
  whyMatch?: string;
};

type FilmArt = { logo: string | null; still: string | null };

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

function useCarouselArt(films: SelectFilm[]) {
  const [art, setArt] = useState<Record<number, FilmArt>>({});
  const ids = films.map((f) => f.id).join(',');

  useEffect(() => {
    let cancelled = false;
    const next: Record<number, FilmArt> = {};

    const load = async () => {
      await Promise.all(
        films.map(async (film) => {
          const fallbackStill = tmdbImage(film.backdrop) || film.poster;
          const fallbackLogo = film.logo ?? null;
          try {
            const api = await fetch(
              `/api/movie-images?id=${film.id}&type=${film.mediaType === 'tv' ? 'tv' : 'movie'}`,
            );
            if (api.ok) {
              const data = await api.json();
              if (data?.logo || data?.still) {
                next[film.id] = {
                  logo: data.logo || fallbackLogo,
                  still: data.still || fallbackStill,
                };
                return;
              }
            }
          } catch {
            /* local vite has no /api */
          }
          if (!TMDB_API_KEY || !film.id) {
            next[film.id] = { logo: fallbackLogo, still: fallbackStill };
            return;
          }
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
            const stillPath =
              data?.stills?.[0]?.file_path || data?.backdrops?.[0]?.file_path || null;
            next[film.id] = {
              logo: preferred?.file_path ? tmdbImage(preferred.file_path, 'w500') : fallbackLogo,
              still: stillPath ? tmdbImage(stillPath, 'w780') : fallbackStill,
            };
          } catch {
            next[film.id] = { logo: fallbackLogo, still: fallbackStill };
          }
        }),
      );
      if (!cancelled) setArt(next);
    };

    load();
    return () => {
      cancelled = true;
    };
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
}: {
  film: CalendarEvent;
  onOpen: () => void;
}) {
  const clip = useDayClip(film);
  const still = clip?.still || film.backdrop || film.poster;
  const logo = clip?.logo;

  return (
    <button
      type="button"
      data-testid="day-stage"
      aria-label={film.title}
      onClick={onOpen}
      className="absolute inset-0 overflow-hidden bg-black min-h-11"
      style={{ containerType: 'size' }}
    >
      {clip?.key ? (
        <iframe
          key={clip.key}
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
      <span className="absolute inset-0 z-10 flex items-center justify-center px-8">
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
    </button>
  );
}

function SelectCard({
  film,
  art,
  onClick,
}: {
  film: SelectFilm;
  art?: FilmArt;
  onClick: () => void;
}) {
  const still = art?.still || film.backdrop || film.poster;
  const logo = art?.logo || film.logo;
  const whyLine = film.whyMatch ? firstSentence(film.whyMatch) : '';
  return (
    <button
      type="button"
      data-testid="ticket-slot"
      aria-label={film.title}
      onClick={onClick}
      className="relative w-full overflow-hidden bg-base-3 min-h-11"
      style={{ height: whyLine ? 168 : 148, borderRadius: 0, border: 'none' }}
    >
      {still && (
        <img
          src={still}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: 0.38 }}
        />
      )}
      <span className="absolute inset-0 flex flex-col items-center justify-center px-6 gap-2">
        {logo ? (
          <img
            src={logo}
            alt=""
            className="relative object-contain"
            style={{
              maxHeight: 48,
              maxWidth: '70%',
              filter: 'drop-shadow(0 4px 16px rgba(0,0,0,.8))',
            }}
          />
        ) : (
          <span className="font-display font-extrabold text-fg text-lg tracking-tight text-center leading-none">
            {film.title}
          </span>
        )}
        {whyLine ? (
          <span className="font-spec text-[10px] uppercase tracking-widest text-fg-2 text-center line-clamp-1" data-testid="why-match-line">
            {whyLine}
          </span>
        ) : null}
      </span>
    </button>
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
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [slide, setSlide] = useState(1);
  const [slideTransition, setSlideTransition] = useState(true);
  const [paused, setPaused] = useState(false);
  const { picks, status } = useRecommendation({ events });
  const stripTrackRef = useRef<HTMLDivElement | null>(null);
  const carouselStartX = useRef<number | null>(null);
  const swallowClick = useRef(false);
  const slideIdsRef = useRef('');

  const days = useMemo(() => {
    const today = startOfDay(new Date());
    const start = subDays(today, 180);
    const count = 180 + 60 + 1;
    return Array.from({ length: count }, (_, i) => addDays(start, i));
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const k = eventDayKey(e.date);
      if (!k) continue;
      const list = map.get(k) ?? [];
      list.push(e);
      map.set(k, list);
    }
    return map;
  }, [events]);

  const dayFilm = (byDay.get(dayKey(selected)) ?? [])[0] ?? null;
  const yearCount = events.filter((e) =>
    eventDayKey(e.date).startsWith(String(selected.getFullYear())),
  ).length;

  const slides = useMemo(() => {
    return picks.slice(0, 3).map((p) => ({
      id: p.movieId,
      title: p.title,
      poster: p.poster,
      backdrop: p.backdrop,
      mediaType: p.mediaType,
      year: p.year,
      runtime: p.runtime,
      whyMatch: p.reason,
    }));
  }, [picks]);

  const art = useCarouselArt(slides);
  const looped = useMemo(() => loopingSlides(slides), [slides]);
  const slideKey = slides.map((s) => s.id).join(',');

  useEffect(() => {
    if (slideIdsRef.current === slideKey) return;
    slideIdsRef.current = slideKey;
    setSlideTransition(false);
    setSlide(slides.length < 2 ? 0 : 1);
  }, [slideKey, slides.length]);

  useEffect(() => {
    if (slideTransition) return;
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setSlideTransition(true));
    });
    return () => window.cancelAnimationFrame(id);
  }, [slideTransition, slide]);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = window.setInterval(() => {
      setSlideTransition(true);
      setSlide((i) => i + 1);
    }, 4500);
    return () => window.clearInterval(t);
  }, [paused, slides.length]);

  const go = (dir: number) => {
    if (slides.length < 2) return;
    setSlideTransition(true);
    setSlide((i) => i + dir);
  };

  const onCarouselTransitionEnd = () => {
    const snapped = snapLoopIndex(slide, slides.length);
    if (snapped == null) return;
    setSlideTransition(false);
    setSlide(snapped);
  };

  const trackSlide = slides.length < 2 ? 0 : slide;

  useEffect(() => {
    const track = stripTrackRef.current;
    if (!track) return;
    const active = track.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!active) return;
    const nextLeft = active.offsetLeft - track.clientWidth + active.offsetWidth;
    track.scrollTo({ left: Math.max(0, nextLeft), behavior: 'instant' });
  }, []);

  const onCarouselPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    carouselStartX.current = e.clientX;
    setPaused(true);
  };
  const finishCarouselPointer = (e: React.PointerEvent, applySwipe: boolean) => {
    if (carouselStartX.current == null) {
      setPaused(false);
      return;
    }
    const dx = e.clientX - carouselStartX.current;
    carouselStartX.current = null;
    if (applySwipe && Math.abs(dx) >= 40) {
      swallowClick.current = true;
      go(dx < 0 ? 1 : -1);
    }
    window.setTimeout(() => setPaused(false), 6000);
  };

  return (
    <div
      className="bg-base text-fg flex flex-col overflow-hidden"
      data-testid="home-strip"
      style={{ height: 'calc(100dvh - var(--tab-h) - env(safe-area-inset-bottom))' }}
    >
      <header className="px-7 pt-6 pb-4 flex items-start justify-between">
        <Mark variant="lockup" size={36} />
        <button
          type="button"
          data-testid="year-zoom"
          onClick={onYearZoom}
          className="min-h-11 min-w-11 px-3 font-spec text-[10px] uppercase tracking-widest text-fg-2 border border-line"
        >
          Year
        </button>
      </header>

      {insightsLabel && (
        <button
          type="button"
          onClick={onOpenProfile}
          className="px-7 font-spec text-[10px] uppercase tracking-widest text-fg-3 mb-4 text-left"
          data-testid="insights-label"
        >
          {insightsLabel}
        </button>
      )}

      <div className="px-7 shrink-0">
        <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3 mb-3">your selects</p>
        {status === 'loading' && (
          <div data-testid="selects-skeleton">
            <Skeleton className="w-full h-[148px]" />
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
          <div
            className="overflow-hidden"
            data-testid="selects-carousel"
            style={{ touchAction: 'pan-y' }}
            onPointerDown={onCarouselPointerDown}
            onPointerUp={(e) => finishCarouselPointer(e, true)}
            onPointerCancel={(e) => finishCarouselPointer(e, false)}
            onClickCapture={(e) => {
              if (!swallowClick.current) return;
              e.preventDefault();
              e.stopPropagation();
              swallowClick.current = false;
            }}
          >
            <div
              className="flex"
              data-testid="selects-carousel-track"
              data-slide={trackSlide}
              onTransitionEnd={(e) => {
                if (e.target !== e.currentTarget) return;
                onCarouselTransitionEnd();
              }}
              style={{
                transform: `translateX(-${trackSlide * 100}%)`,
                transition: slideTransition && slides.length > 1 ? 'transform 420ms ease' : 'none',
              }}
            >
              {looped.map((film, i) => (
                <div key={`${film.id}-${i}`} className="w-full shrink-0">
                  <SelectCard
                    film={film}
                    art={art[film.id]}
                    onClick={() => onOpenMovie(film.id, film.mediaType, film.whyMatch)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0" />

      <div
        className="fixed left-0 right-0 z-40 bg-base pt-3"
        data-testid="strip-dock"
        style={{ bottom: 'calc(var(--tab-h) + env(safe-area-inset-bottom))' }}
      >
        {dayFilm ? (
          <div
            className="relative px-7 mb-2"
            style={{ height: '28vh', maxHeight: 220, minHeight: 140 }}
          >
            <DayStage
              key={dayFilm.movieId}
              film={dayFilm}
              onOpen={() => onOpenMovie(dayFilm.movieId, dayFilm.mediaType)}
            />
          </div>
        ) : null}
        {dayFilm ? (
          <p className="px-7 mb-2 font-spec text-[10px] uppercase tracking-widest text-fg-3">
            {format(selected, 'EEEE d')}
            {'  ·  '}
            {yearCount} this year
          </p>
        ) : (
          <button
            type="button"
            data-testid="ticket-slot-empty"
            onClick={() => onAddMovie(selected)}
            className="px-7 mb-2 text-left font-spec text-[10px] uppercase tracking-widest text-fg-3"
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
                    setSelected(d);
                    if (!film) onAddMovie(d);
                  }}
                  className="flex shrink-0 flex-col items-center gap-0.5 w-6 min-h-11"
                >
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
    </div>
  );
}
