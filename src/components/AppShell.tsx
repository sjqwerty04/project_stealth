import { useLocation } from 'react-router-dom';
import TabBar from './TabBar';

const TAB_PREFIXES = [
  '/app',
  '/discover',
  '/orbit',
  '/dna',
  '/movie',
  '/watched',
  '/watchlist',
  '/liked',
  '/saved',
  '/shared',
  '/vibes',
  '/me',
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const showTabs = TAB_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return (
    <>
      <div className={showTabs ? 'screen-pad' : undefined}>{children}</div>
      {showTabs && <TabBar />}
    </>
  );
}
