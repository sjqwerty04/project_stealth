import { filmsOf, normalizeQuery, queriesOf } from './gate';
import { filmIdentity, type TheaterSignal } from './types';

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = (1n << 64n) - 1n;

// SubtleCrypto is async and unavailable on insecure origins; FNV-1a runs synchronously in every browser and in Node.
export function fnv1a64(text: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, '0');
}

export function fingerprint(signals: readonly TheaterSignal[]): string {
  const queries = [...new Set(queriesOf(signals).map((q) => normalizeQuery(q.text)))].sort();
  const films = [...new Set(filmsOf(signals).map(filmIdentity))].sort();
  return fnv1a64(JSON.stringify([queries, films]));
}
