import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUserProfile } from '../hooks/useUserProfile';
import { Mark } from './ui';
import TabIcon from './TabIcon';
import { tabActive, tabs } from './TabBar';

function useWideScreen() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const apply = () => setWide(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);
  return wide;
}

function RailBody() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const name = profile?.displayName || user?.email?.split('@')[0] || 'You';
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <aside className="desktop-rail" aria-label="Sections">
      <NavLink to="/app" aria-label="Home">
        <Mark size={22} />
      </NavLink>
      <nav className="flex flex-col gap-0.5">
        {tabs.map((tab) => {
          const active = tabActive(tab.id, pathname);
          return (
            <NavLink
              key={tab.id}
              to={tab.to}
              aria-current={active ? 'page' : undefined}
              className={`rail-item ${active ? 'text-fg' : 'text-fg-3'}`}
            >
              {active && <span className="rail-lamp" aria-hidden />}
              <TabIcon name={tab.id === 'orbit' ? 'hunt' : tab.id} on={active} size={20} />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <NavLink to="/me" className="rail-you">
        <span className="rail-swatch" aria-hidden>{initial}</span>
        <span>
          <b className="block max-w-[128px] truncate text-sm font-semibold text-fg">{name}</b>
          <span className="font-spec text-[10px] uppercase tracking-widest text-fg-3">You</span>
        </span>
      </NavLink>
    </aside>
  );
}

export default function DesktopRail() {
  const wide = useWideScreen();
  if (!wide) return null;
  return <RailBody />;
}
