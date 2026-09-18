import SelectsCarousel, { type SelectFilm } from '../components/SelectsCarousel';

const PREVIEW_SLIDES: SelectFilm[] = [
  { id: 1, title: 'Select 1', poster: '', whyMatch: 'First pick.' },
  { id: 2, title: 'Select 2', poster: '', whyMatch: 'Second pick.' },
  { id: 3, title: 'Select 3', poster: '', whyMatch: 'Third pick.' },
];

export default function SelectsCarouselPreviewScreen() {
  return (
    <div className="min-h-dvh bg-base text-fg px-7 pt-10">
      <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3 mb-3">your selects</p>
      <SelectsCarousel slides={PREVIEW_SLIDES} art={{}} onOpenMovie={() => {}} autoplay={false} />
    </div>
  );
}
