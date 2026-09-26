import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { formatNative, type BlendResult } from '../lib/selectScore/blend';
import type { SourceKey } from '../lib/selectScore/types';
import type { TasteSnapshot } from '../lib/taste/types';
import { useSelectScore, type SelectScoreQuery } from '../hooks/useSelectScore';

const SENTENCE = 'Sixty percent what the platforms think, 40% tailored for you.';

const EASE = [0.22, 1, 0.36, 1] as const;

const MARKS: Record<SourceKey, { src: string; alt: string }> = {
  letterboxd: { src: '/scores/letterboxd.svg', alt: 'Letterboxd' },
  imdb: { src: '/scores/imdb.svg', alt: 'IMDb' },
  tomatoes: { src: '/scores/tomatometer.svg', alt: 'Tomatometer' },
  audience: { src: '/scores/audience.svg', alt: 'Audience' },
  metacritic: { src: '/scores/metacritic.svg', alt: 'Metacritic' },
  queue: { src: '/scores/queue.svg', alt: 'Queue' },
};

function SelectBars({ score, open, reduce }: { score: number; open: boolean; reduce: boolean }) {
  const height = open ? 30 : 36;
  const width = open ? 8 : 9;
  const gap = open ? 3 : 4;
  return (
    <span className="inline-flex items-center" style={{ height, gap }} aria-hidden>
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.min(1, Math.max(0, (score - index * 20) / 20));
        return (
          <motion.span
            key={index}
            className="relative overflow-hidden bg-fg"
            initial={false}
            animate={{ width, height }}
            transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }}
            style={{ skewX: '-13.5deg' }}
          >
            <span className="absolute inset-x-0 bottom-0 bg-select" style={{ height: `${fill * 100}%` }} />
          </motion.span>
        );
      })}
    </span>
  );
}

export function SelectScoreLockup({ result }: { result: BlendResult }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion() === true;
  if (result.score == null) return null;

  const logos = result.rows.filter((row) => row.native != null);
  const motionProps = reduce ? { duration: 0 } : { duration: 0.28, ease: EASE };

  return (
    <div className="mt-4 flex flex-col items-start" data-testid="select-score">
      <button
        type="button"
        className="flex flex-col items-start bg-transparent p-0 text-left"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="font-spec text-[10px] uppercase tracking-widest text-fg-3">Select</span>
        <span className="mt-1.5 flex items-center gap-3.5">
          <span className="inline-flex items-center gap-2.5">
            <SelectBars score={result.score} open={open} reduce={reduce} />
            <motion.span
              className="font-extrabold leading-none tracking-tight text-fg tabular-nums"
              initial={false}
              animate={{ fontSize: open ? 44 : 52 }}
              transition={motionProps}
            >
              {result.score}
            </motion.span>
          </span>
          <span className="max-w-[156px] text-[13px] leading-[18px] text-fg" style={{ opacity: 0.48 }}>
            {SENTENCE}
          </span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && logos.length > 0 && (
          <motion.div
            key="breakdown"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={motionProps}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-4">
              {logos.map((row) => (
                <span
                  key={row.key}
                  className={`inline-flex items-center gap-1.5 ${row.thin ? 'opacity-40' : ''}`}
                  data-thin={row.thin ? 'true' : 'false'}
                >
                  <img src={MARKS[row.key].src} alt={MARKS[row.key].alt} className="h-4 w-auto" />
                  <span className="text-sm font-extrabold tabular-nums text-fg">{formatNative(row.key, row.native as number)}</span>
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SelectScore(props: Omit<SelectScoreQuery, 'snapshot'> & { snapshot: TasteSnapshot }) {
  const result = useSelectScore(props);
  return <SelectScoreLockup result={result} />;
}
