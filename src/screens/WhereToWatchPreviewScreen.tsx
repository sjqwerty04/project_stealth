import WhereToWatch from '../components/WhereToWatch';
import type { WatchProviders } from '../lib/watchProviders';

const LINK = 'https://www.themoviedb.org/movie/680/watch?locale=US';

const PULP: WatchProviders = {
  link: LINK,
  stream: [
    { id: 119, name: 'Amazon Prime Video', logoPath: '/prime.jpg', priority: 1 },
    { id: 257, name: 'fuboTV', logoPath: '/fubo.jpg', priority: 2 },
    { id: 2303, name: 'Paramount Plus Premium', logoPath: '/p.jpg', priority: 3 },
    { id: 2304, name: 'Paramount Plus Essential', logoPath: '/p.jpg', priority: 4 },
    { id: 188, name: 'YouTube TV', logoPath: '/yt.jpg', priority: 5 },
    { id: 2100, name: 'Amazon Prime Video with Ads', logoPath: '/prime.jpg', priority: 6 },
  ],
  free: [],
  ads: [],
  rent: [
    { id: 9, name: 'Amazon Video', logoPath: '/a.jpg', priority: 1 },
    { id: 486, name: 'Spectrum On Demand', logoPath: '/xiUQmGI2bi8Rn6C5u2bArB4YHMp.jpg', priority: 2 },
    { id: 2, name: 'Apple TV Store', logoPath: '/apple.jpg', priority: 3 },
    { id: 7, name: 'Fandango At Home', logoPath: '/f.jpg', priority: 4 },
  ],
  buy: [
    { id: 9, name: 'Amazon Video', logoPath: '/a.jpg', priority: 1 },
    { id: 2, name: 'Apple TV Store', logoPath: '/apple.jpg', priority: 2 },
    { id: 7, name: 'Fandango At Home', logoPath: '/f.jpg', priority: 3 },
  ],
};

export default function WhereToWatchPreviewScreen() {
  return (
    <div className="min-h-screen bg-base px-4 py-6 text-fg">
      <div className="mx-auto max-w-md">
        <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3">Pulp Fiction · 1994</p>
        <h1 className="mt-2 text-2xl font-bold">Where to watch</h1>
        <div className="mt-6">
          <WhereToWatch providers={PULP} />
        </div>
      </div>
    </div>
  );
}
