import type { TastePick } from './types';

export type CachedSelects = {
  picks: TastePick[];
  at: number;
};

const memory = new Map<string, CachedSelects>();
const persist = new Map<string, string>();

function storageKey(uid: string) {
  return `selects:lastPicks:${uid}`;
}

function persistGet(uid: string): string | null {
  if (typeof localStorage !== 'undefined') {
    try {
      const val = localStorage.getItem(storageKey(uid));
      if (val) return val;
    } catch {
      // quota or private browsing
    }
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      const val = sessionStorage.getItem(storageKey(uid));
      if (val) return val;
    } catch {
      return persist.get(storageKey(uid)) ?? null;
    }
  }
  return persist.get(storageKey(uid)) ?? null;
}

function persistSet(uid: string, raw: string) {
  persist.set(storageKey(uid), raw);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(storageKey(uid), raw);
    } catch {
      // quota or private browsing
    }
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(storageKey(uid), raw);
    } catch {
      // quota
    }
  }
}

export function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^.+?[.!?]+/);
  return (match ? match[0] : trimmed).trim();
}

export function selectsCacheFresh(entry: CachedSelects | null, _now = Date.now()): entry is CachedSelects {
  if (!entry?.picks?.length) return false;
  return true;
}

export function readSelectsCache(uid: string): CachedSelects | null {
  const fromMem = memory.get(uid);
  if (fromMem?.picks.length) return fromMem;
  const raw = persistGet(uid);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedSelects;
    if (!Array.isArray(parsed?.picks) || !parsed.picks.length) return null;
    memory.set(uid, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writeSelectsCache(uid: string, picks: TastePick[], at = Date.now()): CachedSelects {
  const entry: CachedSelects = { picks, at };
  memory.set(uid, entry);
  persistSet(uid, JSON.stringify(entry));
  return entry;
}

export function forgetSelectsCacheMemory(uid: string) {
  memory.delete(uid);
}

export function hitSelectsCache(
  uid: string,
  snapshotPicks: TastePick[],
  snapshotAt: number | null
): CachedSelects | null {
  const cached = readSelectsCache(uid);
  if (snapshotPicks.length && snapshotAt && cached?.at && snapshotAt > cached.at) {
    return writeSelectsCache(uid, snapshotPicks, snapshotAt);
  }
  if (selectsCacheFresh(cached)) return cached;
  if (snapshotPicks.length) {
    return writeSelectsCache(uid, snapshotPicks, snapshotAt || Date.now());
  }
  return null;
}
