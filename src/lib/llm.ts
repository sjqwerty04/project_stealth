const CACHE_PREFIX = 'llm_cache_';
const CACHE_TTL = 1000 * 60 * 60 * 24;

const memoryCache = new Map<string, { value: string; timestamp: number }>();

let lastCallTime = 0;
const MIN_CALL_INTERVAL = 100;

const hashPrompt = (prompt: string): string => {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
};

const getFromStorage = (key: string): string | null => {
  try {
    const stored = localStorage.getItem(CACHE_PREFIX + key);
    if (stored) {
      const { value, timestamp } = JSON.parse(stored);
      if (Date.now() - timestamp < CACHE_TTL) {
        return value;
      }
      localStorage.removeItem(CACHE_PREFIX + key);
    }
  } catch {
    // ignore
  }
  return null;
};

const saveToStorage = (key: string, value: string): void => {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
      value,
      timestamp: Date.now(),
    }));
  } catch {
    // ignore
  }
};

const cleanupOldCache = (): void => {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    keys.forEach(key => {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const { timestamp } = JSON.parse(stored);
          if (Date.now() - timestamp > CACHE_TTL) {
            localStorage.removeItem(key);
          }
        } catch {
          localStorage.removeItem(key);
        }
      }
    });
  } catch {
    // ignore
  }
};

cleanupOldCache();

export const extractJSON = (text: string): any | null => {
  if (!text || typeof text !== 'string') return null;

  let jsonStr: string | null = null;

  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  if (!jsonStr) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
  }

  if (!jsonStr) {
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }
  }

  if (!jsonStr) {
    console.error('extractJSON: No JSON found in response');
    return null;
  }

  jsonStr = jsonStr
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/^\s+|\s+$/g, '')
    .replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('extractJSON parse error:', e);
    return null;
  }
};

export const callLlm = async (
  prompt: string,
  systemPrompt?: string,
): Promise<string | null> => {
  const cacheKey = hashPrompt(prompt + (systemPrompt || ''));

  const memoryCached = memoryCache.get(cacheKey);
  if (memoryCached && Date.now() - memoryCached.timestamp < CACHE_TTL) {
    return memoryCached.value;
  }

  const storageCached = getFromStorage(cacheKey);
  if (storageCached) {
    memoryCache.set(cacheKey, { value: storageCached, timestamp: Date.now() });
    return storageCached;
  }

  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;
  if (timeSinceLastCall < MIN_CALL_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_CALL_INTERVAL - timeSinceLastCall));
  }
  lastCallTime = Date.now();

  try {
    if (prompt.length > 1000000) {
      throw new Error('Prompt exceeds maximum length');
    }

    const response = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, systemPrompt }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      const message = errorData.error || errorData.details || `Grok API ${response.status}`;
      console.error('Grok proxy error:', response.status, errorData);
      if (String(message).includes('XAI_API_KEY')) {
        throw new Error('XAI_API_KEY not configured');
      }
      throw new Error(message);
    }

    const data = await response.json();
    const result = data.text || null;

    if (!result) {
      return null;
    }

    memoryCache.set(cacheKey, { value: result, timestamp: Date.now() });
    saveToStorage(cacheKey, result);

    return result;
  } catch (error) {
    console.error('Grok API call failed:', error);
    if (error instanceof Error && error.message.includes('XAI_API_KEY')) {
      throw error;
    }
    return null;
  }
};

export const callLlmForJSON = async <T = any>(
  prompt: string,
  systemPrompt?: string,
  maxRetries: number = 2
): Promise<T | null> => {
  const response = await callLlm(prompt, systemPrompt);
  if (!response) {
    return null;
  }

  let parsed = extractJSON(response);
  if (parsed) {
    return parsed as T;
  }

  for (let retry = 0; retry < maxRetries; retry++) {
    const repairPrompt = `<task>
The following text was supposed to be valid JSON but it's incomplete or malformed.
Please output ONLY the corrected, complete JSON.
</task>

<malformed_json>
${response}
</malformed_json>

<rules>
- Output ONLY valid JSON
- No markdown code blocks
- No explanations
- Ensure all brackets and quotes are properly closed
</rules>`;

    const retryResponse = await callLlm(
      repairPrompt,
      'You are a JSON repair specialist. Your only job is to fix malformed JSON and output valid JSON.'
    );
    if (!retryResponse) continue;

    parsed = extractJSON(retryResponse);
    if (parsed) {
      return parsed as T;
    }
  }

  return null;
};
