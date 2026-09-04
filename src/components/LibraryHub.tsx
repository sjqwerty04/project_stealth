import { useLocation, useNavigate } from 'react-router-dom';
import TicketStub from './ui/TicketStub';

const rows = [
  { label: 'Watched', meta: 'Films you logged', to: '/watched', hash: 'timeline' },
  { label: 'The Wallet', meta: 'Films closest to you', to: '/liked' },
  { label: 'Saved', meta: 'Waiting', to: '/saved' },
  { label: 'Rooms', meta: 'Lists you keep', to: '/watchlist' },
  { label: 'Shared lists', meta: 'Watch with others', to: '/shared' },
  { label: 'Vibes', meta: 'Saved hunts', to: '/vibes' },
];

export default function LibraryHub() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <div className="px-7 pt-6 pb-4" data-testid="library-hub">
      <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3">Library</p>
      <h1 className="font-display text-2xl text-fg mt-1 mb-4">Everything you have kept.</h1>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <TicketStub
            key={r.to}
            title={r.label}
            meta={r.meta}
            selected={pathname === r.to && r.hash !== 'timeline'}
            onClick={() => navigate(r.hash === 'timeline' ? '/watched#timeline' : r.to)}
          />
        ))}
      </div>
    </div>
  );
}
