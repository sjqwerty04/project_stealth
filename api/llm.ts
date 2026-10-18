import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callXai, streamXai, XaiConfigError } from './_lib/xai.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, systemPrompt, maxTokens, reasoningEffort, model, serviceTier, promptCacheKey } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const tokens = typeof maxTokens === 'number' ? maxTokens : 4096;
  const effort = reasoningEffort !== undefined ? reasoningEffort : 'medium';

  if (req.body?.stream) {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    const send = (obj: unknown) => {
      res.write(`${JSON.stringify(obj)}\n`);
      (res as VercelResponse & { flush?: () => void }).flush?.();
    };
    const allowedModel = model === 'grok-4.7' || model === 'grok-4.3' ? model : undefined;
    try {
      for await (const delta of streamXai({
        messages: [{ role: 'user', content: prompt }],
        system: systemPrompt,
        maxTokens: tokens,
        reasoningEffort: effort,
        model: allowedModel,
        serviceTier: allowedModel === 'grok-4.7' && serviceTier === 'priority' ? 'priority' : undefined,
        promptCacheKey: typeof promptCacheKey === 'string' && promptCacheKey.length > 0 && promptCacheKey.length <= 64
          ? promptCacheKey
          : undefined,
      })) {
        if (delta) send({ d: delta });
      }
    } catch (error: unknown) {
      if (error instanceof XaiConfigError) {
        console.error('XAI_API_KEY not set in environment');
        send({ error: 'XAI_API_KEY not configured' });
      } else {
        console.error('Grok stream error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        send({ error: message });
      }
    }
    return res.end();
  }

  try {
    const text = await callXai({
      messages: [{ role: 'user', content: prompt }],
      system: systemPrompt,
      maxTokens: tokens,
      reasoningEffort: effort,
    });
    return res.status(200).json({ text: text || null });
  } catch (error: any) {
    if (error instanceof XaiConfigError) {
      console.error('XAI_API_KEY not set in environment');
      return res.status(500).json({ error: 'XAI_API_KEY not configured' });
    }
    console.error('Grok proxy error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
