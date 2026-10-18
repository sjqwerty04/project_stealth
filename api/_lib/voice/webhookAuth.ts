import { createHmac, timingSafeEqual } from 'node:crypto';
import { bearerMatches } from './auth.js';

const MAX_SKEW_MS = 5 * 60 * 1000;

function header(headers: Record<string, string | string[] | undefined>, name: string): string {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

function secretKey(secret: string): Buffer {
  return secret.startsWith('whsec_') ? Buffer.from(secret.slice('whsec_'.length), 'base64') : Buffer.from(secret);
}

export function signWebhook(id: string, timestamp: string, rawBody: string, secret: string): string {
  const mac = createHmac('sha256', secretKey(secret)).update(`${id}.${timestamp}.${rawBody}`).digest('base64');
  return `v1,${mac}`;
}

export function verifyWebhookSignature(
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
  secret: string | undefined,
  now = Date.now(),
): boolean {
  if (!secret) return false;
  const id = header(headers, 'webhook-id');
  const timestamp = header(headers, 'webhook-timestamp');
  const signature = header(headers, 'webhook-signature');
  if (!id || !timestamp || !signature) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now - seconds * 1000) > MAX_SKEW_MS) return false;
  const expected = signWebhook(id, timestamp, rawBody, secret).slice('v1,'.length);
  const expectedBuf = Buffer.from(expected);
  return signature.split(' ').some((part) => {
    const sig = part.startsWith('v1,') ? part.slice(3) : '';
    const got = Buffer.from(sig);
    return got.length === expectedBuf.length && timingSafeEqual(got, expectedBuf);
  });
}

export function webhookAuthorized(
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
): boolean {
  if (bearerMatches(headers.authorization ?? headers.Authorization, process.env.VOICE_WEBHOOK_TOKEN)) return true;
  return verifyWebhookSignature(headers, rawBody, process.env.VOICE_WEBHOOK_SECRET);
}
