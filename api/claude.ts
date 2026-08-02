import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guard } from './_lib/http';
import { AI_LIMIT } from './_lib/rateLimit';

// VITE_ is read as a fallback so an existing deployment keeps working; the
// prefix is wrong here because it marks a variable as safe to inline into the
// client bundle, which an Anthropic key never is.
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || process.env.VITE_CLAUDE_API_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await guard(req, res, { methods: ['POST'], rateLimit: AI_LIMIT });
  if (!auth.ok) return;

  const { prompt, systemPrompt, model = 'claude-sonnet-4-5' } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  if (!CLAUDE_API_KEY) {
    console.error('CLAUDE_API_KEY not set in environment');
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const requestBody: any = {
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    };

    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      return res.status(response.status).json({
        error: `Claude API error: ${response.status}`,
        details: errorText,
      });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || null;

    return res.status(200).json({ text });
  } catch (error: any) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
