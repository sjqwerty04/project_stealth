import { NavLink, useLocation } from 'react-router-dom';

const tabs = [
  { id: 'home', label: 'Home', to: '/app' },
  { id: 'orbit', label: 'Orbit', to: '/discover' },
  { id: 'library', label: 'Library', to: '/watched' },
  { id: 'you', label: 'You', to: '/me' },
] as const;

function tabActive(id: string, pathname: string) {
  if (id === 'home') return pathname === '/app';
  if (id === 'orbit') {
    return (
      pathname.startsWith('/discover') ||
      pathname.startsWith('/orbit/') ||
      pathname.startsWith('/dna/') ||
      pathname.startsWith('/movie/')
    );
  }
  if (id === 'library') {
    return (
      pathname.startsWith('/watched') ||
      pathname.startsWith('/watchlist') ||
      pathname.startsWith('/liked') ||
      pathname.startsWith('/saved') ||
      pathname.startsWith('/shared') ||
      pathname.startsWith('/vibes')
    );
  }
  return pathname === '/me';
}

export default function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav
      data-testid="tab-bar"
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-50 bg-base border-t border-line font-spec"
      style={{ height: 'calc(68px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="h-[68px] max-w-md mx-auto grid grid-cols-4">
        {tabs.map((tab) => {
          const active = tabActive(tab.id, pathname);
          return (
            <NavLink
              key={tab.id}
              to={tab.to}
              data-testid={`tab-${tab.id}`}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center justify-center min-h-11 font-spec text-[10px] uppercase tracking-widest ${
                active ? 'text-fg' : 'text-fg-3'
              }`}
            >
              <span className="flex flex-col items-center gap-1">
                <span
                  className={active ? 'bg-fg' : 'bg-line'}
                  style={{ width: 16, height: 4, transform: 'skewX(-13.5deg)' }}
                  aria-hidden
                />
                {tab.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
