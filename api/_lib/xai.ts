const XAI_API_KEY = process.env.XAI_API_KEY || '';
const DEFAULT_MODEL = 'grok-4.6';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export class XaiConfigError extends Error {
  constructor() {
    super('XAI_API_KEY not configured');
    this.name = 'XaiConfigError';
  }
}

function extractText(data: any): string {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text;
  }
  const parts: string[] = [];
  for (const item of data?.output || []) {
    if (item?.type !== 'message') continue;
    for (const c of item.content || []) {
      if (c?.type === 'output_text' && typeof c.text === 'string') {
        parts.push(c.text);
      }
    }
  }
  return parts.join('');
}

export async function callXai(opts: {
  messages: ChatMessage[];
  system?: string;
  maxTokens?: number;
  webSearch?: boolean;
}): Promise<string> {
  if (!XAI_API_KEY) throw new XaiConfigError();

  const body: Record<string, unknown> = {
    model: DEFAULT_MODEL,
    store: false,
    reasoning: { effort: 'medium' },
    max_output_tokens: opts.maxTokens ?? 4096,
    input: opts.messages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (opts.system) body.instructions = opts.system;
  if (opts.webSearch) body.tools = [{ type: 'web_search' }];

  const res = await fetch('https://api.x.ai/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`xAI error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return extractText(data);
}

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
