import { toE164 } from '../../../src/lib/phone.js';
import { withVoiceDb } from './db.js';
import { userIdFromToken } from './firebaseUser.js';
import { claimCaller, lookupImport } from './store.js';

export type ImportBody = { phone?: unknown; idToken?: unknown; confirm?: unknown };

export async function handleImport(body: ImportBody): Promise<{ status: number; body: Record<string, unknown> }> {
  const phone = toE164(typeof body.phone === 'string' ? body.phone : '');
  if (!phone) return { status: 400, body: { error: 'Enter a real phone number.' } };
  const userId = await userIdFromToken(typeof body.idToken === 'string' ? body.idToken : '');
  if (!userId) return { status: 401, body: { error: 'Sign in again to bring a call over.' } };

  try {
    return await withVoiceDb(async (client) => {
      if (body.confirm === true) {
        const claimed = await claimCaller(client, phone, userId);
        return { status: 200, body: { phone, claimed: claimed === 'claimed', alreadyImported: claimed === 'already' } };
      }
      const found = await lookupImport(client, phone);
      if (!found.caller) return { status: 200, body: { found: false, phone } };
      if (found.caller.importedToUserId) {
        return { status: 200, body: { found: true, phone, alreadyImported: true } };
      }
      return {
        status: 200,
        body: {
          found: true,
          phone,
          alreadyImported: false,
          likes: found.likes.map((film) => ({
            title: film.title,
            year: film.year ?? '',
            tmdbId: film.tmdbId,
            reason: film.reason ?? '',
            posterPath: film.posterPath,
          })),
          picks: found.picks.map((film) => ({
            title: film.title,
            year: film.year ?? '',
            tmdbId: film.tmdbId,
            posterPath: film.posterPath,
          })),
        },
      };
    });
  } catch (error) {
    console.error('voice import failed', error instanceof Error ? error.message : 'error');
    return { status: 503, body: { error: 'The call log is unavailable.' } };
  }
}
