import { createContext, useContext } from 'react';
import type { QueryMode, TheaterFilm, TheaterSession } from '../lib/theater';

export type TheaterApi = {
  session: TheaterSession;
  commitSettledQuery: (text: string, mode: QueryMode) => void;
  recordFilmView: (film: TheaterFilm) => void;
  recordDetailExit: (filmId: number, ms: number) => void;
  markTheaterEngaged: (filmId: number) => void;
  keepTheater: () => Promise<boolean>;
  dismissTheater: () => void;
  isKeeping: boolean;
};

export const TheaterContext = createContext<TheaterApi | null>(null);

export function useTheater(): TheaterApi {
  const api = useContext(TheaterContext);
  if (!api) throw new Error('useTheater must be used within a TheaterProvider');
  return api;
}
