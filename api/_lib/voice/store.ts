import type pg from 'pg';

export type VoiceFilm = {
  title: string;
  year: string | null;
  tmdbId: number | null;
  posterPath: string | null;
  reason: string | null;
  liked: boolean | null;
};

export type CallerRow = {
  id: string;
  phoneE164: string;
  importedToUserId: string | null;
  importedAt: string | null;
};

function filmFrom(row: {
  title: string;
  year: string | null;
  tmdb_id: number | null;
  poster_path?: string | null;
  reason?: string | null;
  liked?: boolean | null;
}): VoiceFilm {
  return {
    title: row.title,
    year: row.year,
    tmdbId: row.tmdb_id,
    posterPath: row.poster_path ?? null,
    reason: row.reason ?? null,
    liked: row.liked ?? null,
  };
}

export async function upsertCaller(client: pg.Client, phoneE164: string): Promise<CallerRow> {
  const result = await client.query<{
    id: string;
    phone_e164: string;
    imported_to_user_id: string | null;
    imported_at: Date | null;
  }>(
    `INSERT INTO callers (phone_e164) VALUES ($1)
     ON CONFLICT (phone_e164) DO UPDATE SET phone_e164 = EXCLUDED.phone_e164
     RETURNING id, phone_e164, imported_to_user_id, imported_at`,
    [phoneE164],
  );
  const row = result.rows[0];
  return {
    id: row.id,
    phoneE164: row.phone_e164,
    importedToUserId: row.imported_to_user_id,
    importedAt: row.imported_at ? row.imported_at.toISOString() : null,
  };
}

export async function startCall(client: pg.Client, callerId: string, xaiCallId: string): Promise<{ id: string; created: boolean }> {
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO calls (caller_id, xai_call_id) VALUES ($1, $2)
     ON CONFLICT (xai_call_id) DO NOTHING
     RETURNING id`,
    [callerId, xaiCallId],
  );
  if (inserted.rows[0]) return { id: inserted.rows[0].id, created: true };
  const existing = await client.query<{ id: string }>(`SELECT id FROM calls WHERE xai_call_id = $1`, [xaiCallId]);
  return { id: existing.rows[0].id, created: false };
}

export async function endCall(client: pg.Client, callId: string): Promise<void> {
  await client.query(`UPDATE calls SET ended_at = COALESCE(ended_at, now()) WHERE id = $1`, [callId]);
}

export async function addMention(
  client: pg.Client,
  input: { callId: string; callerId: string; title: string; year: string | null; tmdbId: number | null; liked: boolean; reason: string | null },
): Promise<void> {
  await client.query(
    `INSERT INTO mentions (call_id, caller_id, title, year, tmdb_id, liked, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [input.callId, input.callerId, input.title, input.year, input.tmdbId, input.liked, input.reason],
  );
}

export async function addSuggestion(
  client: pg.Client,
  input: { callId: string; callerId: string; title: string; year: string | null; tmdbId: number | null; reaction: string },
): Promise<void> {
  await client.query(
    `INSERT INTO suggestions (call_id, caller_id, title, year, tmdb_id, reaction)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [input.callId, input.callerId, input.title, input.year, input.tmdbId, input.reaction],
  );
}

export async function addPicks(
  client: pg.Client,
  input: { callId: string; callerId: string; picks: { title: string; year: string | null; tmdbId: number | null; posterPath: string | null }[]; smsOptIn: boolean },
): Promise<void> {
  await client.query(`UPDATE calls SET sms_opt_in = $2 WHERE id = $1`, [input.callId, input.smsOptIn]);
  for (const pick of input.picks) {
    await client.query(
      `INSERT INTO final_picks (call_id, caller_id, title, year, tmdb_id, poster_path)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [input.callId, input.callerId, pick.title, pick.year, pick.tmdbId, pick.posterPath],
    );
  }
}

export async function priorLikes(client: pg.Client, callerId: string): Promise<{ title: string; reason: string | null }[]> {
  const result = await client.query<{ title: string; reason: string | null }>(
    `SELECT DISTINCT ON (lower(title)) title, reason
     FROM mentions
     WHERE caller_id = $1 AND liked IS TRUE
     ORDER BY lower(title), created_at DESC
     LIMIT 8`,
    [callerId],
  );
  return result.rows;
}

export async function lookupImport(client: pg.Client, phoneE164: string): Promise<{
  caller: CallerRow | null;
  likes: VoiceFilm[];
  picks: VoiceFilm[];
}> {
  const callerResult = await client.query<{
    id: string;
    phone_e164: string;
    imported_to_user_id: string | null;
    imported_at: Date | null;
  }>(`SELECT id, phone_e164, imported_to_user_id, imported_at FROM callers WHERE phone_e164 = $1`, [phoneE164]);
  const row = callerResult.rows[0];
  if (!row) return { caller: null, likes: [], picks: [] };
  const caller: CallerRow = {
    id: row.id,
    phoneE164: row.phone_e164,
    importedToUserId: row.imported_to_user_id,
    importedAt: row.imported_at ? row.imported_at.toISOString() : null,
  };
  if (caller.importedToUserId) return { caller, likes: [], picks: [] };
  const likes = await client.query(
    `SELECT DISTINCT ON (lower(title)) title, year, tmdb_id, reason, liked
     FROM mentions
     WHERE caller_id = $1 AND liked IS TRUE
     ORDER BY lower(title), created_at DESC`,
    [caller.id],
  );
  const picks = await client.query(
    `SELECT DISTINCT ON (lower(title)) title, year, tmdb_id, poster_path
     FROM final_picks
     WHERE caller_id = $1
     ORDER BY lower(title), created_at DESC`,
    [caller.id],
  );
  return { caller, likes: likes.rows.map(filmFrom), picks: picks.rows.map(filmFrom) };
}

/** Sets the import stamp once. A second user, or a second try, does not take the row. */
export async function claimCaller(client: pg.Client, phoneE164: string, userId: string): Promise<'claimed' | 'missing' | 'already'> {
  const result = await client.query(
    `UPDATE callers
     SET imported_to_user_id = $2, imported_at = now()
     WHERE phone_e164 = $1 AND imported_to_user_id IS NULL
     RETURNING id`,
    [phoneE164, userId],
  );
  if (result.rows[0]) return 'claimed';
  const existing = await client.query(`SELECT imported_to_user_id FROM callers WHERE phone_e164 = $1`, [phoneE164]);
  if (!existing.rows[0]) return 'missing';
  return 'already';
}

export async function callContext(client: pg.Client, callId: string): Promise<{ callId: string; callerId: string } | null> {
  const result = await client.query<{ id: string; caller_id: string }>(`SELECT id, caller_id FROM calls WHERE id = $1`, [callId]);
  const row = result.rows[0];
  return row ? { callId: row.id, callerId: row.caller_id } : null;
}
