import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signWebhook, verifyWebhookSignature, webhookAuthorized } from './webhookAuth.js';

describe('webhook auth', () => {
  it('accepts a fresh standard-webhooks signature and rejects a stale one', () => {
    const secret = `whsec_${Buffer.from('selects-voice-test').toString('base64')}`;
    const raw = '{"type":"realtime.call.incoming"}';
    const id = 'msg_1';
    const now = 1_700_000_000_000;
    const timestamp = String(Math.floor(now / 1000));
    const headers = {
      'webhook-id': id,
      'webhook-timestamp': timestamp,
      'webhook-signature': signWebhook(id, timestamp, raw, secret),
    };
    expect(verifyWebhookSignature(headers, raw, secret, now)).toBe(true);
    expect(verifyWebhookSignature(headers, raw, secret, now + 10 * 60 * 1000)).toBe(false);
    expect(verifyWebhookSignature(headers, '{"tampered":true}', secret, now)).toBe(false);
  });

  it('accepts the bearer token the sandbox uses for tool calls', () => {
    process.env.VOICE_WEBHOOK_TOKEN = 'voice-test-token';
    expect(webhookAuthorized({ authorization: 'Bearer voice-test-token' }, '')).toBe(true);
    expect(webhookAuthorized({ authorization: 'Bearer wrong' }, '')).toBe(false);
    delete process.env.VOICE_WEBHOOK_TOKEN;
  });

  it('signature helper matches a direct hmac', () => {
    const secret = 'plain-secret';
    const mac = createHmac('sha256', Buffer.from(secret)).update('id.1.{}').digest('base64');
    expect(signWebhook('id', '1', '{}', secret)).toBe(`v1,${mac}`);
    expect(readFileSync(new URL('../../../voice/session.mjs', import.meta.url), 'utf8')).toContain('/api/voice/tool');
  });
});
