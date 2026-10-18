import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sessionUpdate, type PriorLike } from '../../../src/lib/voice/sessionPlan.js';

function appUrl(): string {
  const explicit = process.env.VOICE_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://selects-film.vercel.app';
}

function sessionScript(): string {
  const candidates = [
    join(process.cwd(), 'voice/session.mjs'),
    new URL('../../../voice/session.mjs', import.meta.url),
  ];
  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, 'utf8');
    } catch {
      // The function bundle and a local checkout lay the file out differently.
    }
  }
  throw new Error('voice/session.mjs is not in the function bundle');
}

export async function startCallSandbox(input: {
  callId: string;
  xaiCallId: string;
  prior: PriorLike[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!process.env.XAI_API_KEY) return { ok: false, error: 'XAI_API_KEY is not set' };
  if (!process.env.VOICE_WEBHOOK_TOKEN) return { ok: false, error: 'VOICE_WEBHOOK_TOKEN is not set' };
  try {
    const { Sandbox } = await import('@vercel/sandbox');
    const sandbox = await Sandbox.create({
      timeout: 10 * 60 * 1000,
      persistent: false,
      resources: { vcpus: 1 },
      networkPolicy: 'allow-all',
      env: {
        XAI_API_KEY: process.env.XAI_API_KEY,
        VOICE_WEBHOOK_TOKEN: process.env.VOICE_WEBHOOK_TOKEN,
        VOICE_APP_URL: appUrl(),
        VOICE_CALL_ID: input.callId,
        XAI_CALL_ID: input.xaiCallId,
      },
    });
    const script = sessionScript();
    await sandbox.writeFiles([
      { path: 'session.mjs', content: Buffer.from(script) },
      { path: 'session.json', content: Buffer.from(JSON.stringify(sessionUpdate(input.prior))) },
    ]);
    await sandbox.runCommand({
      cmd: 'bash',
      args: ['-c', 'cd /vercel/sandbox && npm install --no-save ws && node session.mjs'],
      detached: true,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'sandbox failed' };
  }
}
