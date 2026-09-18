import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  loopingSlides,
  SELECTS_AUTOPLAY_MS,
  SELECTS_TRANSITION_EASE,
  SELECTS_TRANSITION_MS,
  snapLoopIndex,
  type RelatedPoster,
} from './selectsCarousel';

export type { RelatedPoster };

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
  related?: RelatedPoster[];
};

export type FilmArt = { logo: string | null; still: string | null };

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
  const related = film.related?.slice(0, 2) ?? [];
  const why = film.whyMatch?.trim() ?? '';
  return (
    <button
      type="button"
      data-testid="ticket-slot"
      aria-label={film.title}
      onClick={onClick}
      className="relative w-full overflow-hidden bg-base text-left min-h-11"
      style={{ borderRadius: 0, border: 'none' }}
    >
      <span className="relative block w-full overflow-hidden bg-base-3" style={{ height: 220 }}>
        {still ? (
          <img src={still} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <span className="absolute inset-0 flex items-center justify-center px-6">
          {logo ? (
            <img
              src={logo}
              alt=""
              className="relative object-contain"
              style={{
                maxHeight: 56,
                maxWidth: '70%',
                filter: 'drop-shadow(0 4px 16px rgba(0,0,0,.8))',
              }}
            />
          ) : (
            <span className="font-display font-extrabold text-fg text-lg tracking-tight text-center leading-none">
              {film.title}
            </span>
          )}
        </span>
      </span>
      {related.length > 0 ? (
        <span className="flex gap-2 pt-3" data-testid="related-posters">
          {related.map((row) => (
            <span
              key={row.title}
              className="block overflow-hidden bg-base-3"
              style={{ width: 56, height: 84, borderRadius: 2 }}
            >
              <img src={row.poster} alt="" className="h-full w-full object-cover" />
            </span>
          ))}
        </span>
      ) : null}
      {why ? (
        <span className="block pt-3 pb-1">
          <span
            className="font-spec text-[10px] uppercase tracking-widest text-fg-3"
            data-testid="why-watch-label"
          >
            Why should I watch this?
          </span>
          <span
            className="mt-2 block font-display text-sm text-fg-2 leading-relaxed break-words"
            data-testid="why-match-line"
          >
            {why}
          </span>
        </span>
      ) : null}
    </button>
  );
}

export default function SelectsCarousel({
  slides,
  art,
  onOpenMovie,
  autoplay = true,
  intervalMs = SELECTS_AUTOPLAY_MS,
}: {
  slides: SelectFilm[];
  art: Record<number, FilmArt>;
  onOpenMovie: (id: number, mediaType?: string, whyMatch?: string) => void;
  autoplay?: boolean;
  intervalMs?: number;
}) {
  const [slide, setSlide] = useState(slides.length < 2 ? 0 : 1);
  const [slideTransition, setSlideTransition] = useState(true);
  const [paused, setPaused] = useState(false);
  const carouselStartX = useRef<number | null>(null);
  const swallowClick = useRef(false);
  const slideIdsRef = useRef('');
  const trackRef = useRef<HTMLDivElement | null>(null);
  const resumeTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const looped = useMemo(() => loopingSlides(slides), [slides]);
  const slideKey = slides.map((s) => s.id).join(',');
  const count = slides.length;
  const trackSlide = count < 2 ? 0 : slide;

  const jumpTo = (index: number) => {
    setSlideTransition(false);
    setSlide(index);
  };

  useEffect(() => {
    if (slideIdsRef.current === slideKey) return;
    slideIdsRef.current = slideKey;
    jumpTo(count < 2 ? 0 : 1);
  }, [slideKey, count]);

  useLayoutEffect(() => {
    if (slideTransition) return;
    const node = trackRef.current;
    if (node) void node.offsetWidth;
  }, [slide, slideTransition]);

  useEffect(() => {
    if (slideTransition) return;
    const id = window.requestAnimationFrame(() => setSlideTransition(true));
    return () => window.cancelAnimationFrame(id);
  }, [slideTransition]);

  useEffect(() => {
    const snapped = snapLoopIndex(slide, count);
    if (snapped == null) return;
    const t = window.setTimeout(() => jumpTo(snapped), SELECTS_TRANSITION_MS + 80);
    return () => window.clearTimeout(t);
  }, [slide, count]);

  useEffect(() => {
    if (!autoplay || paused || count < 2) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = window.setInterval(() => {
      setSlide((i) => {
        if (snapLoopIndex(i, count) != null) return i;
        return i + 1;
      });
      setSlideTransition(true);
    }, intervalMs);
    return () => window.clearInterval(t);
  }, [autoplay, paused, count, intervalMs]);

  useEffect(() => {
    return () => {
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    };
  }, []);

  const go = (dir: number) => {
    if (count < 2) return;
    setSlide((i) => {
      if (snapLoopIndex(i, count) != null) return i;
      return i + dir;
    });
    setSlideTransition(true);
  };

  const onCarouselTransitionEnd = () => {
    const snapped = snapLoopIndex(slide, count);
    if (snapped == null) return;
    jumpTo(snapped);
  };

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
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => setPaused(false), 6000);
  };

  if (!slides.length) return null;

  return (
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
        ref={trackRef}
        className="flex"
        data-testid="selects-carousel-track"
        data-slide={trackSlide}
        onTransitionEnd={(e) => {
          if (e.target !== e.currentTarget) return;
          onCarouselTransitionEnd();
        }}
        style={{
          transform: `translateX(-${trackSlide * 100}%)`,
          transition:
            slideTransition && slides.length > 1
              ? `transform ${SELECTS_TRANSITION_MS}ms ${SELECTS_TRANSITION_EASE}`
              : 'none',
        }}
      >
        {looped.map((film, i) => (
          <div key={`${film.id}-${i}`} className="w-full min-w-full shrink-0 overflow-hidden">
            <SelectCard
              film={film}
              art={art[film.id]}
              onClick={() => onOpenMovie(film.id, film.mediaType, film.whyMatch)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
