import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSharedWatchlists } from '../hooks/useSharedWatchlists';
import { savedCount, useLibrary, walletCount, watchedCount } from '../lib/library';
import { useTheaters } from '../lib/theater';
import { libraryRows } from './libraryRows';

export default function LibraryHub() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { films } = useLibrary();
  const { theaters } = useTheaters();
  const { lists } = useSharedWatchlists();

  const rows = useMemo(() => {
    const people = new Set<string>();
    for (const list of lists) for (const uid of list.memberUids ?? []) people.add(uid);
    return libraryRows({
      watched: watchedCount(films),
      wallet: walletCount(films),
      saved: savedCount(films),
      theaters: theaters.length,
      sharedLists: lists.length,
      sharedPeople: people.size,
    });
  }, [films, theaters, lists]);

  return (
    <div className="px-7 pt-8 pb-4" data-testid="library-hub">
      <h2 data-spec className="text-label tracking-widest text-fg">LIBRARY</h2>
      <p className="mt-2 font-spec text-label tracking-widest text-fg-3">EVERYTHING YOU HAVE KEPT</p>
      <div className="mt-6 flex flex-col gap-3">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => navigate(row.to)}
            data-testid={`library-row-${row.id}`}
            aria-current={pathname === row.to ? 'page' : undefined}
            className="flex w-full min-h-11 items-center gap-4 border-l-2 border-line bg-base-2 px-4 py-4 text-left"
            style={{ borderRadius: 0 }}
          >
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lead font-extrabold text-fg" data-testid="library-label">
                {row.label}
              </span>
              <span className="mt-1 block font-spec text-label tracking-widest text-fg-2" data-testid="library-meta">
                {row.meta}
              </span>
            </span>
            <span className="text-fg-2" aria-hidden>
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
