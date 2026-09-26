import { blendSelect } from '../lib/selectScore/blend';
import { SelectScoreLockup } from '../components/SelectScore';

const heat = blendSelect(94, [
  { key: 'letterboxd', native: 4.32, count: 1_304_042 },
  { key: 'queue', native: 93, count: 4958 },
  { key: 'imdb', native: 8.3, count: 796_000 },
  { key: 'audience', native: 94, count: 100_000 },
  { key: 'tomatoes', native: 84, count: 157 },
  { key: 'metacritic', native: 76, count: 23 },
]);

/** Local fixture of the Heat lockup. The signed-in movie page uses the live route. */
export default function SelectScorePreviewScreen() {
  return (
    <div className="min-h-screen bg-base text-fg">
      <div className="mx-auto min-h-screen w-full max-w-[390px] bg-base">
        <div className="flex h-[42vh] min-h-[280px] items-end justify-center bg-base-2 px-8 pb-8">
          <p className="text-4xl font-extrabold tracking-tight">HEAT</p>
        </div>
        <div className="px-4 pt-4 pb-2">
          <p className="text-center text-sm text-fg-3">1995 • 2h 50m • Michael Mann • R</p>
          <SelectScoreLockup result={heat} />
        </div>
      </div>
    </div>
  );
}
