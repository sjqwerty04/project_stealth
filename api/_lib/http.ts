import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AuthError, verifyRequest, type AuthedUser } from './auth';
import { checkRateLimit, type RateLimitOptions } from './rateLimit';

/**
 * Shared request guard for every /api route: origin allowlist, method check,
 * caller identity, and per-caller rate limiting.
 *
 * These routes previously answered `Access-Control-Allow-Origin: *` with no
 * authentication, so anyone who found the deployment URL could spend the
 * Anthropic budget or make us scrape IMDb from our own IP.
 */

/**
 * Origins permitted to call the API. Vercel preview deployments get a generated
 * subdomain per build, so those are matched by pattern rather than listed.
 */
const STATIC_ALLOWED_ORIGINS = [
  'https://movie-lcursor.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  // Capacitor serves the iOS shell from these schemes.
  'capacitor://localhost',
  'ionic://localhost',
];

const PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+\.vercel\.app$/;

function allowedOrigins(): string[] {
  const extra = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return [...STATIC_ALLOWED_ORIGINS, ...extra];
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // Native apps and server-to-server send no Origin.
  return allowedOrigins().includes(origin) || PREVIEW_ORIGIN.test(origin);
}

function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;

  if (!isOriginAllowed(origin)) {
    res.status(403).json({ error: 'Origin not allowed' });
    return false;
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    // The allowed origin varies per request, so caches must key on it.
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  return true;
}

export type GuardOptions = {
  methods: ('GET' | 'POST')[];
  rateLimit: RateLimitOptions;
  /**
   * Routes that only read public third-party data may run unauthenticated, but
   * are still rate limited by IP. Model-backed routes must never set this.
   */
  allowAnonymous?: boolean;
};

export type GuardResult = { ok: true; user: AuthedUser | null } | { ok: false };

function clientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Runs the full guard. Returns `{ ok: false }` once a response has already been
 * sent, so handlers should return immediately in that case.
 */
export async function guard(
  req: VercelRequest,
  res: VercelResponse,
  options: GuardOptions
): Promise<GuardResult> {
  if (!applyCors(req, res)) return { ok: false };

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return { ok: false };
  }

  if (!options.methods.includes(req.method as 'GET' | 'POST')) {
    res.setHeader('Allow', options.methods.join(', '));
    res.status(405).json({ error: 'Method not allowed' });
    return { ok: false };
  }

  let user: AuthedUser | null = null;
  try {
    user = await verifyRequest(req);
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    if (!options.allowAnonymous) {
      res.status(401).json({ error: 'Authentication required' });
      return { ok: false };
    }
  }

  // Authenticated callers are limited per account so that sharing an IP (offices,
  // mobile carriers, CGNAT) doesn't make one user throttle another.
  const limitKey = user ? `uid:${user.uid}` : `ip:${clientIp(req)}`;
  const limit = checkRateLimit(limitKey, options.rateLimit);

  res.setHeader('X-RateLimit-Limit', String(options.rateLimit.limit));
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(limit.resetAt / 1000)));

  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSeconds));
    res.status(429).json({ error: 'Rate limit exceeded', retryAfter: limit.retryAfterSeconds });
    return { ok: false };
  }

  return { ok: true, user };
}
