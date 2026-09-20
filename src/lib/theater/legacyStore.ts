import { doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { legacyTheatersCollection } from '../legacyTheaters';
import {
  FALLBACK_SWATCHES,
  finiteNumber,
  isRecord,
  nonEmptyString,
  THEATER_DOC_SCHEMA,
  timestampMillis,
  type TheaterDoc,
  type TheaterFilm,
} from './types';

export type LegacySnapshot = { id: string; data: unknown };

export type TheaterWriter = (id: string, theater: TheaterDoc) => Promise<void>;

function parseLegacyFilmRecord(raw: unknown): TheaterFilm | null {
  if (!isRecord(raw) || !finiteNumber(raw.id) || !nonEmptyString(raw.title)) return null;
  return {
    id: raw.id,
    title: raw.title,
    year: typeof raw.year === 'number' ? String(raw.year) : typeof raw.year === 'string' ? raw.year : '',
    posterPath: typeof raw.posterPath === 'string' ? raw.posterPath : null,
    backdropPath: null,
    genres: [],
    director: null,
    mediaType: raw.mediaType === 'tv' ? 'tv' : 'movie',
  };
}

export function theaterFromLegacy(raw: unknown): TheaterDoc | null {
  if (!isRecord(raw) || !nonEmptyString(raw.pattern) || !Array.isArray(raw.movies)) return null;
  const films = raw.movies.map(parseLegacyFilmRecord).filter((film): film is TheaterFilm => film !== null);
  const pattern = raw.pattern.trim();
  return {
    schema: THEATER_DOC_SCHEMA,
    title: pattern,
    facets: null,
    insight: pattern,
    swatches: FALLBACK_SWATCHES,
    sourceSignals: [],
    sourceFilmIds: films.map((film) => film.id),
    lineup: films.map((film) => ({ ...film, reason: '' })),
    keptAt: timestampMillis(raw.createdAt) ?? 0,
  };
}

export async function copyForwardLegacyTheaters(legacy: readonly LegacySnapshot[], write: TheaterWriter): Promise<string[]> {
  const copied: string[] = [];
  for (const { id, data } of legacy) {
    const theater = theaterFromLegacy(data);
    if (!theater) continue;
    await write(id, theater);
    copied.push(id);
  }
  return copied;
}

export async function readLegacyTheaters(uid: string): Promise<LegacySnapshot[]> {
  const snapshot = await getDocs(legacyTheatersCollection(uid));
  return snapshot.docs.map((d) => ({ id: d.id, data: d.data() }));
}

export function theaterDocWriter(uid: string): TheaterWriter {
  return (id, theater) => setDoc(doc(db, 'users', uid, 'theaters', id), theater);
}
