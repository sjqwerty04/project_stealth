// Minimal server-side Anthropic Messages helper for serverless routes.
const CLAUDE_API_KEY = process.env.VITE_CLAUDE_API_KEY || '';
const DEFAULT_MODEL = 'claude-sonnet-4-5';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export async function callAnthropic(opts: {
  messages: ChatMessage[];
  system?: string;
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  if (!CLAUDE_API_KEY) throw new Error('VITE_CLAUDE_API_KEY not configured');

  const body: any = {
    model: opts.model || DEFAULT_MODEL,
    max_tokens: opts.maxTokens || 1024,
    messages: opts.messages,
  };
  if (opts.system) body.system = opts.system;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// Tolerant JSON extraction (mirrors the client lib's strategy).
export function extractJSON<T = any>(text: string): T | null {
  if (!text) return null;
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let jsonStr = codeBlock ? codeBlock[1] : null;
  if (!jsonStr) {
    const obj = text.match(/\{[\s\S]*\}/);
    const arr = text.match(/\[[\s\S]*\]/);
    jsonStr = obj?.[0] || arr?.[0] || null;
  }
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr.replace(/,\s*([}\]])/g, '$1').trim());
  } catch {
    return null;
  }
}
