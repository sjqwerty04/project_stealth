import { isNativePlatform } from './native';

export const PROD_ORIGIN = 'https://selects-film.vercel.app';

export function apiUrlFor(path: string, native: boolean): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return native ? `${PROD_ORIGIN}${normalized}` : normalized;
}

export function apiUrl(path: string): string {
  return apiUrlFor(path, isNativePlatform());
}
