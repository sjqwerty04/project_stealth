import SelectsCarousel, { type SelectFilm } from '../components/SelectsCarousel';

function still(fill: string) {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="${fill}"/></svg>`,
  )}`;
}

function poster(fill: string) {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="${fill}"/></svg>`,
  )}`;
}

const PREVIEW_SLIDES: SelectFilm[] = [
  {
    id: 1,
    title: 'Zodiac',
    poster: poster('#1a1a1c'),
    backdrop: still('#1d1d20'),
    whyMatch:
      "You rated Se7en a 5 and logged All the President's Men last month. Fincher's procedural patience and that newspaper-room paranoia are the same itch this scratches.",
    related: [
      { title: 'Se7en', poster: poster('#3a1d1d') },
      { title: "All the President's Men", poster: poster('#1d3a5b') },
    ],
  },
  {
    id: 2,
    title: 'The Departed',
    poster: poster('#1a1a1c'),
    backdrop: still('#141416'),
    whyMatch:
      'You keep coming back to Infernal Affairs and The Godfather. Scorsese Boston crime web has the same loyalty-as-trap energy you already marked as a 5.',
    related: [
      { title: 'Infernal Affairs', poster: poster('#1d2a3a') },
      { title: 'The Godfather', poster: poster('#2a1d12') },
    ],
  },
  {
    id: 3,
    title: 'Heat',
    poster: poster('#1a1a1c'),
    backdrop: still('#0a0a0b'),
    whyMatch:
      'You logged Thief and Collateral back to back. Mann night-drive professionalism is the through line, and this is the longest cut of that same job.',
    related: [
      { title: 'Thief', poster: poster('#2b2b2f') },
      { title: 'Collateral', poster: poster('#1d5b8a') },
    ],
  },
];

export default function SelectsCarouselPreviewScreen() {
  return (
    <div className="min-h-dvh bg-base text-fg px-7 pt-10">
      <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3 mb-3">your selects</p>
      <SelectsCarousel slides={PREVIEW_SLIDES} art={{}} onOpenMovie={() => {}} />
    </div>
  );
}
