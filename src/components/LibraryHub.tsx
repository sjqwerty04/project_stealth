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

export default function LibraryHub({ count }: { count?: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <div className="px-5 pb-2 pt-5" data-testid="library-hub">
      <h1 className="font-display text-[34px] leading-[0.95] tracking-tight text-fg">The vault.</h1>
      {count ? <div className="mt-2">{count}</div> : null}
      <div className="mt-3 flex flex-col">
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
