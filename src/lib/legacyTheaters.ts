import { collection, doc } from 'firebase/firestore';
import { db } from './firebase';

// Kept Theaters still live in the pre-rename collection until THTR-2 copies them forward.
const LEGACY_COLLECTION = 'saved_vibes';

export const LEGACY_THEATER_ROUTES = ['/vibes', '/rooms'] as const;

export function legacyTheatersCollection(uid: string) {
  return collection(db, 'users', uid, LEGACY_COLLECTION);
}

export function legacyTheaterDoc(uid: string, id: string) {
  return doc(db, 'users', uid, LEGACY_COLLECTION, id);
}
