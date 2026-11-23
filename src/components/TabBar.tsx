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
      className="phone-tabbar"
    >
      <div className="phone-tabbar-row">
        {tabs.map((tab) => {
          const active = tabActive(tab.id, pathname);
          return (
            <NavLink
              key={tab.id}
              to={tab.to}
              data-testid={`tab-${tab.id}`}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              className={`phone-tab${active ? ' on' : ''}`}
            >
              <TabIcon name={tab.id === 'orbit' ? 'hunt' : tab.id} on={active} size={24} />
              <span>{tab.label}</span>
              {active && <i className="phone-tab-lit" aria-hidden />}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
