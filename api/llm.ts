import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callXai, XaiConfigError } from './_lib/xai';

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

  const { prompt, systemPrompt } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  try {
    const text = await callXai({
      messages: [{ role: 'user', content: prompt }],
      system: systemPrompt,
      maxTokens: 4096,
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
