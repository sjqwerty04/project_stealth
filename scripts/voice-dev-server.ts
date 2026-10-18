import http from 'node:http';
import { dispatchVoice } from '../api/_lib/voice/router.ts';

const port = Number(process.env.VOICE_DEV_PORT || 8787);

const server = http.createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  let json: unknown = {};
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    json = {};
  }
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const route = url.pathname.split('/').filter(Boolean).pop() || '';
  try {
    const result = await dispatchVoice(route, {
      headers: req.headers as Record<string, string | string[] | undefined>,
      rawBody: raw,
      json,
    });
    res.writeHead(result.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result.body));
  } catch (error) {
    console.error('voice dev server', error instanceof Error ? error.message : 'error');
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'voice dev server failed' }));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`voice dev server on ${port}`);
});
