import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  loopingSlides,
  SELECTS_AUTOPLAY_MS,
  SELECTS_TRANSITION_EASE,
  SELECTS_TRANSITION_MS,
  slideIdentityKey,
  snapLoopIndex,
  type RelatedPoster,
} from './selectsCarouselLogic';
import type { SelectReplacement, SelectSlotId } from '../hooks/useRecommendation';
import type { Verdict } from '../lib/library';
import VerdictPicker from './VerdictPicker';
import SelectsChaseLoader from './ui/SelectsChaseLoader';

export type { RelatedPoster };

export type SelectFilm = {
  slotId: SelectSlotId;
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

export function SelectCard({
  film,
  art,
  pickerOpen,
  replacement,
  onOpenMovie,
  onOpenPicker,
  onClosePicker,
  onVerdict,
  onRetry,
}: {
  film: SelectFilm;
  art?: FilmArt;
  pickerOpen: boolean;
  replacement: SelectReplacement;
  onOpenMovie: (id: number, mediaType?: string, whyMatch?: string) => void;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onVerdict: (verdict: Verdict) => void;
  onRetry: () => void;
}) {
  const still = art?.still || film.backdrop || film.poster;
  const logo = art?.logo || film.logo;
  const related = film.related?.slice(0, 2) ?? [];
  const why = film.whyMatch?.trim() ?? '';
  const slotReplacement = replacement?.slotId === film.slotId ? replacement : null;
  const loading =
    slotReplacement?.phase === 'saving' || slotReplacement?.phase === 'replacing';
  return (
    <div
      data-testid="ticket-slot"
      data-title={film.title}
      className="relative w-full overflow-hidden bg-base text-left min-h-11"
      style={{ borderRadius: 0, border: 'none' }}
    >
      <button
        type="button"
        data-testid="select-open-movie"
        aria-label={film.title}
        onClick={() => onOpenMovie(film.id, film.mediaType, film.whyMatch)}
        disabled={loading}
        className="relative block w-full overflow-hidden bg-base-3 text-left min-h-11"
        style={{ height: 220 }}
      >
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
      </button>
      {loading ? (
        <div className="absolute inset-x-0 top-0 z-20 flex h-[220px] items-center justify-center bg-black">
          <SelectsChaseLoader
            size="sm"
            label={
              slotReplacement?.phase === 'saving'
                ? 'Saving feedback'
                : 'Finding another select'
            }
          />
        </div>
      ) : null}
      <button
        type="button"
        data-testid={`watched-${film.slotId}`}
        data-carousel-control
        onClick={pickerOpen ? onClosePicker : onOpenPicker}
        disabled={Boolean(slotReplacement && slotReplacement.phase !== 'failed')}
        className="absolute top-3 right-3 z-30 min-h-11 px-3 bg-black/75 border border-white/30 font-spec text-[10px] uppercase tracking-widest text-fg disabled:opacity-50"
      >
        Watched?
      </button>
      {pickerOpen ? (
        <div
          data-carousel-control
          className="relative z-30 border-x border-b border-line bg-base-2 p-3"
        >
          <VerdictPicker
            value={null}
            onChange={onVerdict}
            disabled={Boolean(slotReplacement && slotReplacement.phase !== 'failed')}
            size="sm"
          />
        </div>
      ) : null}
      {slotReplacement?.phase === 'failed' ? (
        <div
          data-carousel-control
          className="flex min-h-11 items-center justify-between gap-3 border-x border-b border-line bg-base-2 p-3"
          data-testid={`replacement-failed-${film.slotId}`}
        >
          <span className="font-spec text-[10px] uppercase tracking-widest text-fg-3">
            {slotReplacement.message}
          </span>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 shrink-0 border border-line px-3 font-spec text-[10px] uppercase tracking-widest text-fg"
          >
            Retry
          </button>
        </div>
      ) : null}
      {related.length > 0 ? (
        <div className="flex gap-2 pt-3" data-testid="related-posters">
          {related.map((row) => {
            const openRelated =
              typeof row.movieId === 'number'
                ? () => onOpenMovie(row.movieId as number, row.mediaType)
                : undefined;
            const body = (
              <img src={row.poster} alt={row.title} className="h-full w-full object-cover" />
            );
            const box = { width: 56, height: 84, borderRadius: 2 };
            return openRelated ? (
              <button
                key={row.title}
                type="button"
                data-testid="related-poster"
                data-carousel-control
                aria-label={row.title}
                onClick={openRelated}
                className="block overflow-hidden bg-base-3"
                style={box}
              >
                {body}
              </button>
            ) : (
              <span key={row.title} className="block overflow-hidden bg-base-3" style={box}>
                {body}
              </span>
            );
          })}
        </div>
      ) : null}
      {why ? (
        <div className="block pt-3 pb-1">
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
        </div>
      ) : null}
    </div>
  );
}

export default function SelectsCarousel({
  slides,
  art,
  onOpenMovie,
  replacements = {},
  onVerdict,
  onRetry,
  autoplay = true,
  intervalMs = SELECTS_AUTOPLAY_MS,
}: {
  slides: SelectFilm[];
  art: Record<number, FilmArt>;
  onOpenMovie: (id: number, mediaType?: string, whyMatch?: string) => void;
  replacements?: Partial<Record<SelectSlotId, NonNullable<SelectReplacement>>>;
  onVerdict: (slotId: SelectSlotId, verdict: Verdict) => void;
  onRetry: (slotId: SelectSlotId) => void;
  autoplay?: boolean;
  intervalMs?: number;
}) {
  const [slide, setSlide] = useState(slides.length < 2 ? 0 : 1);
  const [slideTransition, setSlideTransition] = useState(true);
  const [paused, setPaused] = useState(false);
  const [pickerSlotId, setPickerSlotId] = useState<SelectSlotId | null>(null);
  const carouselStartX = useRef<number | null>(null);
  const swallowClick = useRef(false);
  const capturingSwipe = useRef(false);
  const slideIdsRef = useRef('');
  const trackRef = useRef<HTMLDivElement | null>(null);
  const resumeTimer = useRef<number | null>(null);
  const looped = useMemo(() => loopingSlides(slides), [slides]);
  const slideKey = slideIdentityKey(slides);
  const count = slides.length;
  const trackSlide = count < 2 ? 0 : slide;

  const jumpTo = (index: number) => {
    setSlideTransition(false);
    setSlide(index);
  };

  useEffect(() => {
    if (slideIdsRef.current === slideKey) return;
    slideIdsRef.current = slideKey;
    const id = window.requestAnimationFrame(() => jumpTo(count < 2 ? 0 : 1));
    return () => window.cancelAnimationFrame(id);
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
    if (!autoplay || paused || pickerSlotId !== null || count < 2) return;
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
  }, [autoplay, paused, pickerSlotId, count, intervalMs]);

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
    if ((e.target as HTMLElement).closest('[data-carousel-control]')) return;
    capturingSwipe.current = false;
    carouselStartX.current = e.clientX;
    setPaused(true);
  };
  const onCarouselPointerMove = (e: React.PointerEvent) => {
    if (carouselStartX.current == null || capturingSwipe.current) return;
    if (Math.abs(e.clientX - carouselStartX.current) < 40) return;
    capturingSwipe.current = true;
    swallowClick.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const finishCarouselPointer = (e: React.PointerEvent, applySwipe: boolean) => {
    if (carouselStartX.current == null) {
      setPaused(false);
      return;
    }
    const dx = e.clientX - carouselStartX.current;
    carouselStartX.current = null;
    const swiped = capturingSwipe.current || (applySwipe && Math.abs(dx) >= 40);
    capturingSwipe.current = false;
    if (swiped && applySwipe) {
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
      onPointerMove={onCarouselPointerMove}
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
          <div key={`${film.slotId}-${i}`} className="w-full min-w-full shrink-0 overflow-hidden">
            <SelectCard
              film={film}
              art={art[film.id]}
              pickerOpen={pickerSlotId === film.slotId}
              replacement={replacements[film.slotId] ?? null}
              onOpenMovie={onOpenMovie}
              onOpenPicker={() => setPickerSlotId(film.slotId)}
              onClosePicker={() => setPickerSlotId(null)}
              onVerdict={(verdict) => {
                setPickerSlotId(null);
                onVerdict(film.slotId, verdict);
              }}
              onRetry={() => onRetry(film.slotId)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
