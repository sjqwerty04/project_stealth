import { useLocation } from 'react-router-dom';
import ClaimHandleBanner from './ClaimHandleBanner';
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

/** Routes that fill the viewport and scroll inside themselves instead of scrolling the document. */
const LOCKED_ROUTES = ['/app'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const showTabs = TAB_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const locked = LOCKED_ROUTES.includes(pathname);
  return (
    <div className={`app-shell flex flex-col${locked ? ' app-shell-locked' : ''}`}>
      <ClaimHandleBanner />
      <main
        className={`${locked ? 'flex flex-1 min-h-0 flex-col ' : ''}${showTabs ? 'screen-pad' : ''}`.trim()}
      >
        {children}
      </main>
      {showTabs && <TabBar />}
    </div>
  );
}
