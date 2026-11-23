import { NavLink, useLocation } from 'react-router-dom';
import TabIcon from './TabIcon';

export const tabs = [
  { id: 'home', label: 'Home', to: '/app' },
  { id: 'orbit', label: 'Hunt', to: '/discover' },
  { id: 'library', label: 'Library', to: '/watched' },
  { id: 'you', label: 'You', to: '/me' },
] as const;

export function tabActive(id: string, pathname: string) {
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
      className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-[480px] border-t border-line bg-base/90 font-spec backdrop-blur-md"
      style={{ height: 'calc(68px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid h-[68px] grid-cols-4">
        {tabs.map((tab) => {
          const active = tabActive(tab.id, pathname);
          return (
            <NavLink
              key={tab.id}
              to={tab.to}
              data-testid={`tab-${tab.id}`}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              className={`relative flex items-center justify-center min-h-11 font-spec text-[10px] uppercase tracking-widest ${
                active ? 'text-fg' : 'text-fg-3'
              }`}
            >
              {active && <span className="tab-lamp" aria-hidden />}
              <span className="flex flex-col items-center gap-1">
                <TabIcon name={tab.id === 'orbit' ? 'hunt' : tab.id} on={active} size={22} />
                {tab.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
