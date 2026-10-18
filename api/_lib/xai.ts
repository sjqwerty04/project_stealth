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
  reasoningEffort?: 'low' | 'medium' | 'high' | null;
  webSearch?: boolean;
  /** Data URLs or https URLs attached to the last user message as input_image parts. */
  images?: string[];
  timeoutMs?: number;
}): Promise<string> {
  if (!XAI_API_KEY) throw new XaiConfigError();

  const input = opts.messages.map((m) => ({ role: m.role, content: m.content as unknown }));
  if (opts.images?.length) {
    const lastUser = [...input].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      lastUser.content = [
        { type: 'input_text', text: String(lastUser.content) },
        ...opts.images.map((url) => ({ type: 'input_image', image_url: url, detail: 'high' })),
      ];
    }
  }

  const body: Record<string, unknown> = {
    model: DEFAULT_MODEL,
    store: false,
    max_output_tokens: opts.maxTokens ?? 4096,
    input,
  };
  if (opts.reasoningEffort !== null && opts.reasoningEffort !== undefined) {
    body.reasoning = { effort: opts.reasoningEffort };
  } else if (opts.reasoningEffort === undefined) {
    body.reasoning = { effort: 'medium' };
  }
  if (opts.system) body.instructions = opts.system;
  if (opts.webSearch) body.tools = [{ type: 'web_search' }];

  const res = await fetch('https://api.x.ai/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`xAI error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return extractText(data);
}

/** Streams output text deltas from the Responses API (server-sent events). */
export async function* streamXai(opts: {
  messages: ChatMessage[];
  system?: string;
  maxTokens?: number;
  reasoningEffort?: 'low' | 'medium' | 'high' | null;
}): AsyncGenerator<string> {
  if (!XAI_API_KEY) throw new XaiConfigError();
  const body: Record<string, unknown> = {
    model: DEFAULT_MODEL,
    store: false,
    stream: true,
    max_output_tokens: opts.maxTokens ?? 512,
    input: opts.messages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (opts.reasoningEffort) body.reasoning = { effort: opts.reasoningEffort };
  if (opts.system) body.instructions = opts.system;

  const res = await fetch('https://api.x.ai/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${XAI_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`xAI error ${res.status}: ${await res.text()}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamed = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let event: { type?: string; delta?: unknown; response?: unknown };
      try {
        event = JSON.parse(payload);
      } catch {
        continue;
      }
      if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
        streamed = true;
        yield event.delta;
      } else if (event.type === 'response.completed' && !streamed) {
        const text = extractText(event.response);
        if (text) yield text;
      }
    }
  }
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
