// OpenAI-compatible helper for OpenRouter — used for real-time web-grounded calls.
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

export type ORMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type ORPlugin = { id: 'web'; max_results?: number };

export async function callOpenRouter(opts: {
  model: string;
  messages: ORMessage[];
  plugins?: ORPlugin[];
  maxTokens?: number;
}): Promise<string> {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not configured');

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 60,
  };
  if (opts.plugins?.length) body.plugins = opts.plugins;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://movie-lcursor.vercel.app',
      'X-Title': 'Selects',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return (data.choices?.[0]?.message?.content as string) || '';
}
