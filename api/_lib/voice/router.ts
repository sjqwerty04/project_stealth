import { withVoiceDb } from './db.js';
import { handleImport, type ImportBody } from './importTaste.js';
import { handleIncoming } from './incoming.js';
import { runTool } from './tools.js';
import { webhookAuthorized } from './webhookAuth.js';

export type VoiceResult = { status: number; body: Record<string, unknown> };

export async function dispatchVoice(
  route: string,
  input: {
    headers: Record<string, string | string[] | undefined>;
    rawBody: string;
    json: unknown;
  },
): Promise<VoiceResult> {
  if (route === 'incoming') return handleIncoming(input.headers, input.rawBody, input.json);
  if (route === 'import') return handleImport((input.json ?? {}) as ImportBody);
  if (route === 'tool') {
    if (!webhookAuthorized(input.headers, input.rawBody)) return { status: 401, body: { error: 'unauthorized' } };
    const body = (input.json ?? {}) as { callId?: unknown; name?: unknown; arguments?: unknown };
    const callId = typeof body.callId === 'string' ? body.callId : '';
    const name = typeof body.name === 'string' ? body.name : '';
    const args = body.arguments && typeof body.arguments === 'object' ? (body.arguments as Record<string, unknown>) : {};
    if (!callId || !name) return { status: 400, body: { error: 'callId and name are required' } };
    try {
      const result = await withVoiceDb((client) => runTool(client, callId, name, args));
      return { status: 200, body: result };
    } catch (error) {
      console.error('voice tool failed', error instanceof Error ? error.message : 'error');
      return { status: 503, body: { error: 'call log unavailable' } };
    }
  }
  return { status: 404, body: { error: 'not found' } };
}
