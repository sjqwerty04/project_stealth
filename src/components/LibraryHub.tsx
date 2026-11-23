import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TicketStub from './ui/TicketStub';

export const libraryRows: { label: string; meta: string; to: string; hash?: string }[] = [
  { label: 'Watched', meta: 'Films you logged', to: '/watched', hash: 'timeline' },
  { label: 'The Wallet', meta: 'Films closest to you', to: '/liked' },
  { label: 'Saved', meta: 'Waiting', to: '/saved' },
  { label: 'Rooms', meta: 'Lists you keep', to: '/watchlist' },
  { label: 'Shared lists', meta: 'Watch with others', to: '/shared' },
  { label: 'Vibes', meta: 'Saved hunts', to: '/vibes' },
];

export default function LibraryHub({
  count,
  strip = [],
  wallet = [],
}: {
  count?: ReactNode;
  strip?: string[];
  wallet?: { id: number; title: string; poster: string }[];
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <div className="px-5 pb-2 pt-6" data-testid="library-hub">
      <h1 className="font-display text-[44px] font-extrabold leading-[0.92] tracking-tight text-fg">The vault.</h1>
      {count ? <div className="mt-2">{count}</div> : null}
      {strip.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-[22px] font-semibold tracking-tight text-fg">The Strip</h2>
          <div className="mt-3 flex h-[72px] gap-1">
            {strip.slice(0, 5).map((poster, index) => (
              <button
                key={`${poster}-${index}`}
                type="button"
                onClick={() => navigate('/watched#timeline')}
                className="h-full min-w-0 flex-1 overflow-hidden"
                style={{ transform: 'skewX(-13.5deg)', background: `center/cover url(${poster})` }}
                aria-label="Open the watched timeline"
              />
            ))}
          </div>
        </section>
      )}
      {wallet.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-[22px] font-semibold tracking-tight text-fg">The Wallet</h2>
          <button type="button" onClick={() => navigate('/liked')} className="relative mt-2 flex h-[168px] w-full items-end justify-center">
            {wallet.slice(0, 5).map((film, index) => (
              <img
                key={film.id}
                src={film.poster}
                alt={film.title}
                className="absolute bottom-0 h-[150px] w-[92px] object-cover shadow-lg"
                style={{ transform: `rotate(${(index - 2) * 8}deg) translateX(${(index - 2) * 28}px)` }}
              />
            ))}
          </button>
        </section>
      )}
      <div className="mt-4 flex flex-col">
        {libraryRows.map((row) => (
          <TicketStub
            key={row.to}
            title={row.label}
            meta={row.meta}
            selected={pathname === row.to && row.hash !== 'timeline'}
            onClick={() => navigate(row.hash === 'timeline' ? '/watched#timeline' : row.to)}
          />
        ))}
      </div>
    </div>
  );
}
