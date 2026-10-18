import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetSchemaFlag, withVoiceDb } from './db.js';
import { handleIncoming } from './incoming.js';
import { claimCaller, lastFilm, lookupImport } from './store.js';
import { runTool } from './tools.js';

const url = process.env.VOICE_DATABASE_URL || 'postgresql://voice@127.0.0.1/voice';
const phone = '+12025550198';

async function reachable(): Promise<boolean> {
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    await client.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

const hasDb = await reachable();

describe.skipIf(!hasDb)('voice call log', () => {
  beforeAll(() => {
    process.env.VOICE_DATABASE_URL = url;
    delete process.env.TMDB_API_KEY;
    delete process.env.VITE_TMDB_API_KEY;
    resetSchemaFlag();
  });

  afterAll(async () => {
    await withVoiceDb(async (client) => {
      await client.query(`DELETE FROM campaign_members WHERE caller_id IN (SELECT id FROM callers WHERE phone_e164 = $1)`, [phone]);
      await client.query(`DELETE FROM final_picks WHERE caller_id IN (SELECT id FROM callers WHERE phone_e164 = $1)`, [phone]);
      await client.query(`DELETE FROM suggestions WHERE caller_id IN (SELECT id FROM callers WHERE phone_e164 = $1)`, [phone]);
      await client.query(`DELETE FROM mentions WHERE caller_id IN (SELECT id FROM callers WHERE phone_e164 = $1)`, [phone]);
      await client.query(`DELETE FROM calls WHERE caller_id IN (SELECT id FROM callers WHERE phone_e164 = $1)`, [phone]);
      await client.query(`DELETE FROM callers WHERE phone_e164 = $1`, [phone]);
    });
  });

  it('stores a call, keeps the reason, and imports the caller once', async () => {
    process.env.VOICE_WEBHOOK_TOKEN = 'voice-test-token';
    const incoming = await handleIncoming(
      { authorization: 'Bearer voice-test-token' },
      '',
      {
        type: 'realtime.call.incoming',
        data: { call_id: 'call-test-1', sip_headers: [{ name: 'From', value: phone }] },
      },
      async () => ({ ok: true }),
    );
    expect(incoming.status).toBe(200);
    expect(incoming.body.sandbox).toBe('started');
    const callId = String(incoming.body.callId);

    const remembered = await withVoiceDb((client) =>
      runTool(client, callId, 'remember_film', {
        title: 'Heat',
        year: '1995',
        liked: true,
        reason: 'the telephoto across the street',
      }),
    );
    expect(remembered.ok).toBe(true);

    const missingReason = await withVoiceDb((client) =>
      runTool(client, callId, 'remember_film', { title: 'Heat', liked: true }),
    );
    expect(missingReason.ok).toBe(false);

    await withVoiceDb((client) =>
      runTool(client, callId, 'save_picks', {
        picks: [{ title: 'Sicario', year: '2015' }],
        sms_opt_in: true,
      }),
    );

    const looked = await withVoiceDb((client) => lookupImport(client, phone));
    expect(looked.likes[0]?.reason).toBe('the telephoto across the street');
    expect(looked.picks[0]?.title).toBe('Sicario');
    const earlier = looked.caller ? await withVoiceDb((client) => lastFilm(client, looked.caller!.id)) : null;
    expect(earlier).toBe('Sicario');
    expect(looked.caller?.importedToUserId).toBeNull();

    const first = await withVoiceDb((client) => claimCaller(client, phone, 'user-a'));
    const second = await withVoiceDb((client) => claimCaller(client, phone, 'user-b'));
    expect(first).toBe('claimed');
    expect(second).toBe('already');

    const again = await withVoiceDb((client) => lookupImport(client, phone));
    expect(again.caller?.importedToUserId).toBe('user-a');
    expect(again.likes).toEqual([]);
  });
});
