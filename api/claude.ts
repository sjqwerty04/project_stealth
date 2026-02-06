import type { VercelRequest, VercelResponse } from '@vercel/node';

const CLAUDE_API_KEY = process.env.VITE_CLAUDE_API_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers for the client app
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, systemPrompt, model = 'claude-sonnet-4-5' } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  if (!CLAUDE_API_KEY) {
    console.error('VITE_CLAUDE_API_KEY not set in environment');
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
