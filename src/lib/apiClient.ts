import { auth } from './firebase';

/**
 * Calls our own /api routes with the caller's Firebase ID token attached.
 *
 * Every route behind these paths spends money or scrapes a third party from our
 * IP, so all of them now require a token. getIdToken() serves a cached token and
 * only hits the network when the current one is close to expiry.
 */

export class ApiError extends Error {
  status: number;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};
  try {
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  } catch (error) {
    console.error('Could not obtain an ID token:', error);
    return {};
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(await authHeader())) {
    headers.set(key, value);
  }
  return fetch(path, { ...init, headers });
}

/**
 * apiFetch plus the error translation every caller was otherwise duplicating.
 * Throws ApiError on a non-2xx so callers can distinguish "slow down" from
 * "broken" instead of showing one generic failure.
 */
export async function apiJson<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('Retry-After')) || undefined;
      throw new ApiError('Too many requests', 429, retryAfter);
    }
    if (response.status === 401) {
      throw new ApiError('Not signed in', 401);
    }
    throw new ApiError(`Request failed: ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}
