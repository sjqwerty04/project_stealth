import { useRef, useState, type CSSProperties } from 'react';
import FilmLogo from './FilmLogo';
import { Mark } from './ui';
import SelectsChaseLoader from './ui/SelectsChaseLoader';
import VerdictPicker from './VerdictPicker';
import { selectSlotLoaderVisible } from './homeStripLogic';
import type { FilmArt, SelectFilm } from './SelectsCarousel';
import type { SelectReplacement, SelectSlotId } from '../hooks/useRecommendation';
import type { Verdict } from '../lib/library';

const WATCHED_LABELS: Partial<Record<Verdict, string>> = { okay: 'Meh' };
const LOG_TODAY_LABELS: Partial<Record<Verdict, string>> = { okay: 'Meh', nope: 'Dislike' };

function filmColour(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  const palette = ['#3A6E85', '#8C4A3A', '#6E5A3A', '#3A5A4A', '#5A3A6E', '#8A3A4A'];
  return palette[hash % palette.length];
}

function TearTicket({
  film,
  still,
  logo,
  index,
  time,
  torn,
  onTear,
  onOpen,
}: {
  film: SelectFilm;
  still: string;
  logo?: string;
  index: number;
  time: string;
  torn: boolean;
  onTear: () => void;
  onOpen: () => void;
}) {
  const origin = useRef({ x: 0, y: 0, active: false });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const seat = `ROW ${'FGHJK'[index % 5]} · ${String(7 + index * 3).padStart(2, '0')}`;
  const colour = filmColour(film.title);

  const tear = () => {
    if (torn) return;
    setOffset({ x: 120, y: 36 });
    onTear();
  };

  return (
    <div
      className={`ticket${torn ? ' is-torn' : ''}`}
      style={{ '--film': colour } as CSSProperties}
      data-testid="ticket-slot"
      data-title={film.title}
    >
      <div
        className="ticket-main"
        role="button"
        tabIndex={0}
        data-testid="select-open-movie"
        aria-label={film.title}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onOpen();
        }}
      >
        {still ? <img src={still} alt="" className="ticket-bg" /> : null}
        <div className="ticket-shade" />
        <div className="ticket-top">
          <span className={`font-spec text-[10px] uppercase tracking-widest ${index === 2 ? 'text-select' : 'text-fg/80'}`}>
            {index === 2 ? 'The reach' : `Ticket ${String(index + 1).padStart(2, '0')}`}
          </span>
          <span className="font-spec text-[10px] uppercase tracking-widest text-fg/80">
            {[film.year, film.runtime].filter(Boolean).join(' · ')}
          </span>
        </div>
        <div className="ticket-title">
          {logo ? (
            <FilmLogo src={logo} className="ticket-logo" />
          ) : (
            <h3 className="font-display text-[28px] font-extrabold leading-none tracking-tight text-fg">{film.title}</h3>
          )}
          {film.whyMatch ? (
            <p className="ticket-why" data-testid="why-match-line">{film.whyMatch}</p>
          ) : null}
        </div>
        {torn ? (
          <div className="ticket-stamp">
            <span>KEPT</span>
            <small>TONIGHT · {time}</small>
          </div>
        ) : null}
      </div>
      <div className="ticket-perf" />
      <div
        className="ticket-stub"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) rotate(${offset.x * 0.04}deg)` }}
        onPointerDown={(event) => {
          if (torn) return;
          origin.current = { x: event.clientX, y: event.clientY, active: true };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!origin.current.active || torn) return;
          const dx = Math.max(0, event.clientX - origin.current.x);
          const dy = Math.max(0, event.clientY - origin.current.y);
          setOffset({ x: dx, y: dy });
          if (dx > 86 || dy > 110) tear();
        }}
        onPointerUp={(event) => {
          if (!origin.current.active) return;
          const dx = event.clientX - origin.current.x;
          origin.current.active = false;
          if (dx > 60) tear();
          else if (!torn) setOffset({ x: 0, y: 0 });
        }}
      >
        <span className="font-spec text-[9px] uppercase tracking-widest text-[#3b3a38]">Admit one</span>
        <span className="stub-mark" style={{ '--fg': '#0a0a0b' } as CSSProperties}>
          <Mark size={22} />
        </span>
        <span className="stub-seat font-spec text-[10px] uppercase tracking-tight text-base">{seat}</span>
        <span className="font-spec text-[9px] uppercase tracking-widest text-[#3b3a38]">{time}</span>
        <button type="button" className="sr-only" onClick={tear}>Keep {film.title} for tonight</button>
      </div>
    </div>
  );
}

export default function HomeTickets({
  slides,
  art,
  time,
  replacements,
  onOpenMovie,
  onVerdict,
  onLogToday,
  onNotInterested,
  onRetry,
}: {
  slides: SelectFilm[];
  art: Record<number, FilmArt>;
  time: string;
  replacements: Partial<Record<SelectSlotId, SelectReplacement>>;
  onOpenMovie: (id: number, mediaType?: string, whyMatch?: string) => void;
  onVerdict: (slotId: SelectSlotId, verdict: Verdict) => void;
  onLogToday: (slotId: SelectSlotId, verdict: Verdict) => void;
  onNotInterested: (slotId: SelectSlotId) => void;
  onRetry: (slotId: SelectSlotId) => void;
}) {
  const [torn, setTorn] = useState<Partial<Record<SelectSlotId, boolean>>>({});
  const [picker, setPicker] = useState<SelectSlotId | null>(null);
  const [logOpen, setLogOpen] = useState<SelectSlotId | null>(null);
  const bill = slides.slice(0, 3);

  return (
    <section className="home-tickets" data-testid="home-tickets">
      <div data-testid="selects-carousel">
      <div data-testid="selects-carousel-track">
        {bill.map((film, index) => {
          const still = film.backdrop || art[film.id]?.still || film.poster;
          const logo = art[film.id]?.logo || film.logo;
          const replacement = replacements[film.slotId];
          const loading = selectSlotLoaderVisible(replacement?.phase, replacement?.movieId, film.id);
          return (
            <div key={film.slotId} className="mb-4">
              <div className="relative">
                <TearTicket
                  film={film}
                  still={still}
                  logo={logo}
                  index={index}
                  time={time}
                  torn={torn[film.slotId] === true}
                  onTear={() => setTorn((current) => ({ ...current, [film.slotId]: true }))}
                  onOpen={() => onOpenMovie(film.id, film.mediaType, film.whyMatch)}
                />
                {loading ? (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80">
                    <SelectsChaseLoader
                      size="sm"
                      label={replacement?.phase === 'saving' ? 'Saving feedback' : 'Finding another select'}
                    />
                  </div>
                ) : null}
              </div>
              {!torn[film.slotId] ? (
                <div className="mt-2 flex gap-4 px-1">
                  <button
                    type="button"
                    data-testid={`not-interested-${film.slotId}`}
                    data-carousel-control
                    disabled={loading}
                    onClick={() => onNotInterested(film.slotId)}
                    aria-label="Not interested"
                    className="min-h-11 font-spec text-[10px] uppercase tracking-widest text-fg-3"
                  >
                    Swap
                  </button>
                  <button
                    type="button"
                    data-testid={`watched-${film.slotId}`}
                    data-carousel-control
                    disabled={loading}
                    onClick={() => {
                      setLogOpen(null);
                      setPicker((current) => (current === film.slotId ? null : film.slotId));
                    }}
                    className="min-h-11 font-spec text-[10px] uppercase tracking-widest text-fg-3"
                  >
                    Watched?
                  </button>
                </div>
              ) : null}
              {picker === film.slotId ? (
                <div data-carousel-control className="border border-line bg-base-2 p-3">
                  <VerdictPicker
                    value={null}
                    onChange={(verdict) => {
                      setPicker(null);
                      onVerdict(film.slotId, verdict);
                    }}
                    disabled={loading}
                    size="sm"
                    labels={WATCHED_LABELS}
                    extra={{
                      label: 'Log Today',
                      testId: `log-today-${film.slotId}`,
                      onClick: () => {
                        setPicker(null);
                        setLogOpen(film.slotId);
                      },
                    }}
                  />
                </div>
              ) : null}
              {logOpen === film.slotId ? (
                <div data-testid={`log-today-picker-${film.slotId}`} data-carousel-control className="border border-line bg-base-2 p-3">
                  <VerdictPicker
                    value={null}
                    onChange={(verdict) => {
                      setLogOpen(null);
                      onLogToday(film.slotId, verdict);
                    }}
                    disabled={loading}
                    size="sm"
                    labels={LOG_TODAY_LABELS}
                  />
                </div>
              ) : null}
              {replacement?.phase === 'failed' ? (
                <div data-testid={`replacement-failed-${film.slotId}`} className="mt-2 flex min-h-11 items-center justify-between gap-3">
                  <span className="font-spec text-[10px] uppercase tracking-widest text-fg-3">{replacement.message}</span>
                  <button type="button" onClick={() => onRetry(film.slotId)} className="min-h-11 border border-line px-3 font-spec text-[10px] uppercase tracking-widest">
                    Retry
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      </div>
    </section>
  );
}
