import { Capacitor } from '@capacitor/core';

const NATIVE_ORIGIN = 'https://selects-film.vercel.app';

/** Relative on the web, where `/api` is same-origin. Absolute on iOS, where the bundle has no API server. */
export function apiUrl(path: string): string {
  if (Capacitor.getPlatform() !== 'ios') return path;
  if (/^https?:\/\//i.test(path)) return path;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${NATIVE_ORIGIN}${suffix}`;
}
