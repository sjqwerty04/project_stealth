import { useMemo } from 'react';
import { useLibrary } from '../lib/library';
import { useAuth } from './useAuth';
import { watchedExclusions, type SelectExclusion } from './selectExclusions';

/** The signed-in viewer's watched ledger, as select exclusions. Empty until auth and the ledger are ready, and empty when signed out. */
export function useWatchedExclusions(): {
  excluded: SelectExclusion[];
  ready: boolean;
  signedIn: boolean;
} {
  const { user, loading: authLoading } = useAuth();
  const { films, loading: libraryLoading } = useLibrary();
  const signedIn = !!user;
  const ready = !authLoading && (!signedIn || !libraryLoading);
  const excluded = useMemo(
    () => (ready && signedIn ? watchedExclusions(true, films) : []),
    [ready, signedIn, films],
  );
  return { excluded, ready, signedIn };
}
