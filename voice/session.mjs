/**
 * Runs inside a per-call Vercel Sandbox. Holds the xAI realtime socket for one
 * phone call. The API key and webhook token arrive as env vars and are never logged.
 */
import { readFileSync } from 'node:fs';
import WebSocket from 'ws';

const CALL_CAP_MS = 10 * 60 * 1000;
const WRAP_UP_MS = 8 * 60 * 1000;

const apiKey = process.env.XAI_API_KEY ?? '';
const token = process.env.VOICE_WEBHOOK_TOKEN ?? '';
const appUrl = (process.env.VOICE_APP_URL ?? '').replace(/\/$/, '');
const callId = process.env.VOICE_CALL_ID ?? '';
const xaiCallId = process.env.XAI_CALL_ID ?? '';

const session = JSON.parse(readFileSync(new URL('./session.json', import.meta.url), 'utf8'));

function log(event) {
  console.log(JSON.stringify({ t: Date.now(), event }));
}

async function postTool(name, args) {
  const res = await fetch(`${appUrl}/api/voice/tool`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ callId, name, arguments: args }),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: 'tool endpoint returned an unreadable body' };
  }
}

const started = Date.now();
let wrapped = false;
let closed = false;
const ws = new WebSocket(`wss://api.x.ai/v1/realtime?call_id=${encodeURIComponent(xaiCallId)}`, {
  headers: { Authorization: `Bearer ${apiKey}` },
});

let buffer = [];
let timer = null;

async function flush() {
  const batch = buffer;
  buffer = [];
  timer = null;
  for (const event of batch) {
    let args = {};
    try {
      args = JSON.parse(event.arguments || '{}');
    } catch {
      args = {};
    }
    const result = await postTool(event.name, args);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: event.call_id,
          output: JSON.stringify(result),
        },
      }));
    }
  }
  if (batch.length && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'response.create' }));
  }
}

function enqueue(event) {
  buffer.push(event);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void flush();
  }, 80);
}

function wrapUp() {
  if (wrapped || ws.readyState !== WebSocket.OPEN) return;
  wrapped = true;
  log('wrap_up');
  ws.send(JSON.stringify({
    type: 'session.update',
    session: { instructions: `${session.instructions}\n\nWrap up now. Confirm two or three films, ask the text question, call save_picks, and say goodbye.` },
  }));
  ws.send(JSON.stringify({ type: 'response.create' }));
}

function finish() {
  if (closed) return;
  closed = true;
  log('end');
  void postTool('end_call', {}).finally(() => {
    try {
      ws.close();
    } catch {
      // already closed
    }
    process.exit(0);
  });
}

const wrapTimer = setTimeout(wrapUp, WRAP_UP_MS);
const endTimer = setTimeout(finish, CALL_CAP_MS);

ws.on('open', () => {
  log('open');
  ws.send(JSON.stringify({ type: 'session.update', session }));
  ws.send(JSON.stringify({ type: 'response.create' }));
});

ws.on('message', (data) => {
  let event;
  try {
    event = JSON.parse(String(data));
  } catch {
    return;
  }
  if (event.type === 'error') {
    log('error');
    return;
  }
  if (Date.now() - started >= WRAP_UP_MS) wrapUp();
  if (Date.now() - started >= CALL_CAP_MS) {
    finish();
    return;
  }
  if (event.type === 'response.function_call_arguments.done') enqueue(event);
});

ws.on('close', () => {
  clearTimeout(wrapTimer);
  clearTimeout(endTimer);
  finish();
});

ws.on('error', () => {
  log('socket_error');
  clearTimeout(wrapTimer);
  clearTimeout(endTimer);
  finish();
});
