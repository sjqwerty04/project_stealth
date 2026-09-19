import { useEffect, useRef, useState } from 'react';
import SelectsCarousel, { type SelectFilm } from '../components/SelectsCarousel';
import { relatedFromWhy } from '../components/selectsCarouselLogic';
import type { SelectReplacement } from '../hooks/useRecommendation';

function still(fill: string, label: string) {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="${fill}"/><text x="400" y="240" text-anchor="middle" fill="white" font-size="72" font-family="Arial">${label}</text></svg>`,
  )}`;
}

function poster(fill: string, label: string) {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="${fill}"/><text x="100" y="160" text-anchor="middle" fill="white" font-size="28" font-family="Arial">${label}</text></svg>`,
  )}`;
}

const LOGAN_WHY =
  'X-Men and X2 both got a 5 from you, and Logan is the scarred, adult finish of that world. It has the bruised father and child tension you already rewarded in Cape Fear and Sleepers. The western grit should land if you also wanted something like There Will Be Blood.';

const DIARY = [
  { title: 'Cape Fear', poster: poster('#5a3a12', 'Cape Fear') },
  { title: 'Sleepers', poster: poster('#3a1d1d', 'Sleepers') },
  { title: 'There Will Be Blood', poster: poster('#6a4a12', 'TWBB') },
  { title: 'X-Men: The Last Stand', poster: poster('#1d3a8a', 'X-Men') },
  { title: 'X2: X-Men United', poster: poster('#1d5b8a', 'X2') },
  { title: 'Infernal Affairs', poster: poster('#1d2a3a', 'Infernal') },
  { title: 'The Godfather', poster: poster('#2a1d12', 'Godfather') },
  { title: 'Thief', poster: poster('#2b2b2f', 'Thief') },
  { title: 'Collateral', poster: poster('#1d5b8a', 'Collateral') },
];

const DEPARTED_WHY =
  'You keep coming back to Infernal Affairs and The Godfather. Scorsese Boston crime web has the same loyalty-as-trap energy you already marked as a 5.';

const HEAT_WHY =
  'You logged Thief and Collateral back to back. Mann night-drive professionalism is the through line, and this is the longest cut of that same job.';

const PREVIEW_SLIDES: SelectFilm[] = [
  {
    slotId: 0,
    id: 263115,
    title: 'Logan',
    poster: poster('#1a1a1c', 'Logan'),
    backdrop: still('#c47a12', 'LOGAN'),
    whyMatch: LOGAN_WHY,
    related: relatedFromWhy(LOGAN_WHY, DIARY, 'Logan'),
  },
  {
    slotId: 1,
    id: 2,
    title: 'The Departed',
    poster: poster('#1a1a1c', 'Departed'),
    backdrop: still('#24303a', 'THE DEPARTED'),
    whyMatch: DEPARTED_WHY,
    related: relatedFromWhy(DEPARTED_WHY, DIARY, 'The Departed'),
  },
  {
    slotId: 2,
    id: 3,
    title: 'Heat',
    poster: poster('#1a1a1c', 'Heat'),
    backdrop: still('#2c2520', 'HEAT'),
    whyMatch: HEAT_WHY,
    related: relatedFromWhy(HEAT_WHY, DIARY, 'Heat'),
  },
];

export default function SelectsCarouselPreviewScreen() {
  const [slides, setSlides] = useState(PREVIEW_SLIDES);
  const [replacement, setReplacement] = useState<SelectReplacement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const activeTimers = timers.current;
    return () => activeTimers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return (
    <div className="min-h-dvh bg-base text-fg px-7 pt-10">
      <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3 mb-3">your selects</p>
      <SelectsCarousel
        slides={slides}
        art={{}}
        onOpenMovie={() => {}}
        replacements={replacement ? { [replacement.slotId]: replacement } : {}}
        onVerdict={(slotId) => {
          setReplacement({ slotId, phase: 'saving', feedbackSaved: false });
          timers.current.push(
            window.setTimeout(() => {
              setReplacement({ slotId, phase: 'replacing', feedbackSaved: true });
            }, 500),
            window.setTimeout(() => {
              setSlides((current) =>
                current.map((film) =>
                  film.slotId === slotId
                    ? {
                        ...film,
                        id: 4,
                        title: 'Manhunter',
                        backdrop: still('#302528', 'MANHUNTER'),
                        whyMatch: 'A new select replaced only this stable carousel slot.',
                      }
                    : film,
                ),
              );
              setReplacement(null);
            }, 1800),
          );
        }}
        onRetry={() => {}}
      />
    </div>
  );
}
