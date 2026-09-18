import { useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import type { ImportBundle } from '../lib/library';
import { bundleFromEntries } from '../lib/import/detect';
import { collectCsvEntries } from '../lib/import/files';
import { matchFilms, type MatchResult } from '../lib/import/match';
import { writeLibrary, type WriteSummary } from '../lib/import/write';

export type ImportPhase = 'idle' | 'reading' | 'matching' | 'writing' | 'done' | 'error';

export const PHASE_LABEL: Record<ImportPhase, string> = {
  idle: '',
  reading: 'Reading',
  matching: 'Matching',
  writing: 'Writing',
  done: 'Done',
  error: 'Could not import',
};

/** One intake for every source. Files or a ready bundle go in, a summary comes out. */
export function useLibraryImport() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<WriteSummary | null>(null);
  const [unresolved, setUnresolved] = useState<MatchResult['unresolved']>([]);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase('idle');
    setProgress({ done: 0, total: 0 });
    setSummary(null);
    setUnresolved([]);
    setError(null);
  }, []);

  const importBundle = useCallback(
    async (bundle: ImportBundle): Promise<WriteSummary | null> => {
      if (!user) {
        setError('Not signed in');
        setPhase('error');
        return null;
      }
      try {
        setPhase('matching');
        const inputs = [
          ...bundle.films.map((f) => ({ title: f.title, year: f.year, imdbId: f.imdbId })),
          ...bundle.diary.map((d) => ({ title: d.title, year: d.year })),
          ...bundle.watchlist.map((w) => ({ title: w.title, year: w.year })),
          ...bundle.curious.map((c) => ({ title: c.title, year: c.year })),
        ];
        const match = await matchFilms(inputs, { onProgress: (done, total) => setProgress({ done, total }) });
        setUnresolved(match.unresolved);
        setPhase('writing');
        const result = await writeLibrary(user.uid, bundle, match.matched, {
          email: user.email,
          onProgress: (_phase, done, total) => setProgress({ done, total }),
        });
        setSummary(result);
        setPhase('done');
        return result;
      } catch (err) {
        console.error('library import failed:', err);
        setError('Import failed. Try again.');
        setPhase('error');
        return null;
      }
    },
    [user],
  );

  const importFiles = useCallback(
    async (files: File[]): Promise<WriteSummary | null> => {
      setError(null);
      setPhase('reading');
      try {
        const entries = await collectCsvEntries(files);
        if (!entries.length) {
          setError('No CSV files found. Drop the Letterboxd zip, its folder, or an IMDb ratings.csv.');
          setPhase('error');
          return null;
        }
        const bundle = bundleFromEntries(entries);
        if (!bundle) {
          setError('Those files do not look like a Letterboxd or IMDb export.');
          setPhase('error');
          return null;
        }
        return importBundle(bundle);
      } catch (err) {
        console.error('reading import files failed:', err);
        setError('Could not read those files.');
        setPhase('error');
        return null;
      }
    },
    [importBundle],
  );

  return {
    phase,
    label: PHASE_LABEL[phase],
    progress,
    summary,
    unresolved,
    error,
    isImporting: phase === 'reading' || phase === 'matching' || phase === 'writing',
    importFiles,
    importBundle,
    reset,
  };
}
