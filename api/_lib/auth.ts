import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { VercelRequest } from '@vercel/node';

/**
 * Firebase ID token verification for serverless routes.
 *
 * Verifies against Google's published keys rather than pulling in firebase-admin,
 * which would add a large dependency and a service-account credential to every
 * function for what is one signature check.
 */

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'mvplockedin';

const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;

// Google rotates these; jose caches the set and refetches on unknown key id.
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export type AuthedUser = {
  uid: string;
  email: string | null;
};

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

function bearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization || req.headers.Authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match ? match[1] : null;
}

/**
 * Resolves the caller, or throws AuthError. Callers should translate that into a
 * 401 — see requireUser.
 */
export async function verifyRequest(req: VercelRequest): Promise<AuthedUser> {
  const token = bearerToken(req);
  if (!token) throw new AuthError('Missing bearer token');

  let payload;
  try {
    ({ payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      audience: PROJECT_ID,
      algorithms: ['RS256'],
    }));
  } catch {
    // Deliberately opaque: distinguishing expired from forged from malformed
    // tells an attacker which part of the token to keep working on.
    throw new AuthError('Invalid or expired token');
  }

  const uid = typeof payload.sub === 'string' ? payload.sub : '';
  if (!uid) throw new AuthError('Token has no subject');

  // Firebase sets auth_time on every ID token; its absence means this is some
  // other Google token that happens to validate against the same keys.
  if (typeof payload.auth_time !== 'number') {
    throw new AuthError('Not a Firebase ID token');
  }

  return {
    uid,
    email: typeof payload.email === 'string' ? payload.email : null,
  };
}
