import { timingSafeEqual } from 'crypto';

export function bearerMatches(header: string | string[] | undefined, expected: string | undefined): boolean {
  if (!expected) return false;
  const value = Array.isArray(header) ? header[0] : header;
  const token = (value ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
