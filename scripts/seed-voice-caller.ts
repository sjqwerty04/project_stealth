import { resetSchemaFlag, withVoiceDb } from '../api/_lib/voice/db.ts';
import { addMention, addPicks, startCall, upsertCaller } from '../api/_lib/voice/store.ts';

const phone = process.env.VOICE_SEED_PHONE || '+12025550100';

async function poster(id: number): Promise<string | null> {
  const key = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || '';
  if (!key) return null;
  const res = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${key}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { poster_path?: string | null };
  return data.poster_path ?? null;
}

async function main() {
  if (!process.env.VOICE_DATABASE_URL) throw new Error('VOICE_DATABASE_URL is not set');
  resetSchemaFlag();
  await withVoiceDb(async (client) => {
    const caller = await upsertCaller(client, phone);
    if (caller.importedToUserId) {
      await client.query(`UPDATE callers SET imported_to_user_id = NULL, imported_at = NULL WHERE id = $1`, [caller.id]);
    }
    const call = await startCall(client, caller.id, `seed-${phone}`);
    const mentions = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM mentions WHERE caller_id = $1`, [caller.id]);
    if (mentions.rows[0]?.count !== '0') {
      console.log(`seed already present for ${phone}`);
      return;
    }
    const likes = [
      { title: 'Heat', year: '1995', tmdbId: 949, reason: 'The way Mann holds the telephoto across the street, and the quiet before the guns.' },
      { title: 'Collateral', year: '2004', tmdbId: 1538, reason: 'The digital night, and how Cruise sits in the streetlight.' },
    ];
    for (const like of likes) {
      await addMention(client, { callId: call.id, callerId: caller.id, ...like, liked: true });
    }
    const picks = [
      { title: 'Sicario', year: '2015', tmdbId: 254320 },
      { title: 'Michael Clayton', year: '2007', tmdbId: 4453 },
    ];
    await addPicks(client, {
      callId: call.id,
      callerId: caller.id,
      smsOptIn: true,
      picks: await Promise.all(picks.map(async (pick) => ({ ...pick, posterPath: await poster(pick.tmdbId) }))),
    });
    console.log(`seeded ${phone}`);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'seed failed');
  process.exit(1);
});
