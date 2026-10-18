import { toE164 } from '../../../src/lib/phone.js';
import { withVoiceDb } from './db.js';
import { startCallSandbox } from './sandbox.js';
import { lastFilm, priorLikes, startCall, upsertCaller } from './store.js';
import { webhookAuthorized } from './webhookAuth.js';

type SipHeader = { name?: string; value?: string };
type Start = typeof startCallSandbox;

function callerPhone(json: unknown): string | null {
  const data = (json as { data?: { sip_headers?: SipHeader[] } } | null)?.data;
  const headers = data?.sip_headers ?? [];
  const from = headers.find((header) => header.name?.toLowerCase() === 'from')?.value ?? '';
  const match = from.match(/\+?\d[\d\s().-]{6,}/);
  return toE164(match?.[0] ?? from);
}

export async function handleIncoming(
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
  json: unknown,
  start: Start = startCallSandbox,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!webhookAuthorized(headers, rawBody)) return { status: 401, body: { error: 'unauthorized' } };
  const event = json as { type?: string; data?: { call_id?: string } };
  if (event.type !== 'realtime.call.incoming') return { status: 200, body: { ignored: true } };
  const xaiCallId = event.data?.call_id ?? '';
  if (!xaiCallId) return { status: 400, body: { error: 'missing call_id' } };
  const phone = callerPhone(json);
  if (!phone) return { status: 200, body: { ignored: true, reason: 'no caller phone' } };

  try {
    const started = await withVoiceDb(async (client) => {
      const caller = await upsertCaller(client, phone);
      const call = await startCall(client, caller.id, xaiCallId);
      const prior = call.created ? await priorLikes(client, caller.id) : [];
      const film = call.created ? await lastFilm(client, caller.id) : null;
      return { call, prior, film };
    });
    if (!started.call.created) return { status: 200, body: { ok: true, duplicate: true } };
    const sandbox = await start({ callId: started.call.id, xaiCallId, prior: started.prior, lastFilm: started.film });
    return {
      status: 200,
      body: { ok: true, callId: started.call.id, sandbox: sandbox.ok ? 'started' : 'unavailable' },
    };
  } catch (error) {
    console.error('voice incoming failed', error instanceof Error ? error.message : 'error');
    return { status: 503, body: { error: 'call log unavailable' } };
  }
}
