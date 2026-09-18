import { useEffect, useMemo, useRef, useState } from 'react';
import { firstSentence } from '../lib/taste';
import { loopingSlides, snapLoopIndex } from './selectsCarousel';

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
          <span
            className="font-spec text-[10px] uppercase tracking-widest text-fg-2 text-center line-clamp-1"
            data-testid="why-match-line"
          >
            {whyLine}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export default function SelectsCarousel({
  slides,
  art,
  onOpenMovie,
  autoplay = true,
  intervalMs = 4500,
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
  const resumeTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const looped = useMemo(() => loopingSlides(slides), [slides]);
  const slideKey = slides.map((s) => s.id).join(',');
  const count = slides.length;

  const snapIfClone = (index: number) => {
    const snapped = snapLoopIndex(index, count);
    if (snapped == null) return;
    setSlideTransition(false);
    setSlide(snapped);
  };

  useEffect(() => {
    if (slideIdsRef.current === slideKey) return;
    slideIdsRef.current = slideKey;
    setSlideTransition(false);
    setSlide(count < 2 ? 0 : 1);
  }, [slideKey, count]);

  useEffect(() => {
    if (slideTransition) return;
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setSlideTransition(true));
    });
    return () => window.cancelAnimationFrame(id);
  }, [slideTransition, slide]);

  useEffect(() => {
    const snapped = snapLoopIndex(slide, count);
    if (snapped == null) return;
    const t = window.setTimeout(() => snapIfClone(slide), 430);
    return () => window.clearTimeout(t);
  }, [slide, count]);

  useEffect(() => {
    if (!autoplay || paused || count < 2) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = window.setInterval(() => {
      setSlideTransition(true);
      setSlide((i) => {
        const real = snapLoopIndex(i, count) ?? i;
        return real + 1;
      });
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
    setSlideTransition(true);
    setSlide((i) => {
      const real = snapLoopIndex(i, count) ?? i;
      return real + dir;
    });
  };

  const onCarouselTransitionEnd = () => {
    snapIfClone(slide);
  };

  const trackSlide = count < 2 ? 0 : slide;

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
  );
}
