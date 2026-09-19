const tails = new Map<string, Promise<void>>();

/** Serialize ledger writes for one user so a backfill cannot clobber a live import. */
export function withLibraryWriteLock<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(uid) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  tails.set(
    uid,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}
