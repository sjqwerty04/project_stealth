import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guard, isOriginAllowed } from './http';
import { __resetRateLimits } from './rateLimit';
import { AuthError } from './auth';

vi.mock('./auth', async () => {
  const actual = await vi.importActual<typeof import('./auth')>('./auth');
  return { ...actual, verifyRequest: vi.fn() };
});

const { verifyRequest } = await import('./auth');
const mockVerify = vi.mocked(verifyRequest);

/** Minimal response double that records what a handler sent. */
function mockRes() {
  const headers: Record<string, string> = {};
  const state = { status: 0, body: undefined as unknown, ended: false, headers };
  const res = {
    setHeader: (k: string, v: string | number) => {
      headers[k] = String(v);
      return res;
    },
    status: (code: number) => {
      state.status = code;
      return res;
    },
    json: (body: unknown) => {
      state.body = body;
      return res;
    },
    end: () => {
      state.ended = true;
      return res;
    },
  };
  return { res: res as unknown as VercelResponse, state };
}

function mockReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: { origin: 'http://localhost:5173' },
    query: {},
    ...overrides,
  } as VercelRequest;
}

const OPTS = { methods: ['POST'] as ('GET' | 'POST')[], rateLimit: { limit: 5, windowMs: 60_000 } };

beforeEach(() => {
  __resetRateLimits();
  mockVerify.mockReset();
  mockVerify.mockResolvedValue({ uid: 'user-1', email: 'a@b.com' });
});

afterEach(() => vi.clearAllMocks());

describe('isOriginAllowed', () => {
  it('accepts the production origin and localhost', () => {
    expect(isOriginAllowed('https://movie-lcursor.vercel.app')).toBe(true);
    expect(isOriginAllowed('http://localhost:5173')).toBe(true);
  });

  it('accepts Vercel preview deployments, which get a fresh subdomain per build', () => {
    expect(isOriginAllowed('https://movie-lcursor-git-abc123.vercel.app')).toBe(true);
  });

  it('accepts requests with no Origin, which is how native shells and curl arrive', () => {
    expect(isOriginAllowed(undefined)).toBe(true);
  });

  it('rejects arbitrary origins', () => {
    expect(isOriginAllowed('https://evil.example.com')).toBe(false);
  });

  it('does not let a lookalike host pass the preview pattern', () => {
    expect(isOriginAllowed('https://vercel.app.evil.com')).toBe(false);
    expect(isOriginAllowed('http://movie-lcursor.vercel.app')).toBe(false);
  });
});

describe('guard', () => {
  it('rejects a disallowed origin before doing any other work', async () => {
    const { res, state } = mockRes();
    const result = await guard(mockReq({ headers: { origin: 'https://evil.example.com' } }), res, OPTS);

    expect(result.ok).toBe(false);
    expect(state.status).toBe(403);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('answers preflight without requiring a token', async () => {
    const { res, state } = mockRes();
    const result = await guard(mockReq({ method: 'OPTIONS' }), res, OPTS);

    expect(result.ok).toBe(false);
    expect(state.status).toBe(204);
    expect(state.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
  });

  it('varies on Origin so a cache cannot serve one origin the headers for another', async () => {
    const { res, state } = mockRes();
    await guard(mockReq(), res, OPTS);
    expect(state.headers['Vary']).toBe('Origin');
  });

  it('rejects the wrong method with an Allow header', async () => {
    const { res, state } = mockRes();
    const result = await guard(mockReq({ method: 'GET' }), res, OPTS);

    expect(result.ok).toBe(false);
    expect(state.status).toBe(405);
    expect(state.headers['Allow']).toBe('POST');
  });

  it('401s an unauthenticated caller', async () => {
    mockVerify.mockRejectedValue(new AuthError('Missing bearer token'));
    const { res, state } = mockRes();

    const result = await guard(mockReq(), res, OPTS);

    expect(result.ok).toBe(false);
    expect(state.status).toBe(401);
  });

  it('lets an anonymous caller through only when the route opts in', async () => {
    mockVerify.mockRejectedValue(new AuthError('Missing bearer token'));
    const { res } = mockRes();

    const result = await guard(mockReq(), res, { ...OPTS, allowAnonymous: true });

    expect(result).toEqual({ ok: true, user: null });
  });

  it('passes the verified user through and publishes rate-limit headers', async () => {
    const { res, state } = mockRes();
    const result = await guard(mockReq(), res, OPTS);

    expect(result).toEqual({ ok: true, user: { uid: 'user-1', email: 'a@b.com' } });
    expect(state.headers['X-RateLimit-Limit']).toBe('5');
    expect(state.headers['X-RateLimit-Remaining']).toBe('4');
  });

  it('429s once the caller exhausts the window, with Retry-After', async () => {
    for (let i = 0; i < 5; i++) await guard(mockReq(), mockRes().res, OPTS);

    const { res, state } = mockRes();
    const result = await guard(mockReq(), res, OPTS);

    expect(result.ok).toBe(false);
    expect(state.status).toBe(429);
    expect(Number(state.headers['Retry-After'])).toBeGreaterThan(0);
  });

  it('limits per account, so two users behind one IP do not throttle each other', async () => {
    for (let i = 0; i < 5; i++) await guard(mockReq(), mockRes().res, OPTS);
    expect((await guard(mockReq(), mockRes().res, OPTS)).ok).toBe(false);

    mockVerify.mockResolvedValue({ uid: 'user-2', email: 'c@d.com' });
    expect((await guard(mockReq(), mockRes().res, OPTS)).ok).toBe(true);
  });

  it('propagates a non-auth failure rather than silently allowing the request', async () => {
    mockVerify.mockRejectedValue(new TypeError('network down'));
    const { res } = mockRes();

    await expect(guard(mockReq(), res, OPTS)).rejects.toThrow('network down');
  });
});
