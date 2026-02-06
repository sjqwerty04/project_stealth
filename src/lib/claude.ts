const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY || '';

// Persistent cache using localStorage for longer-term storage
const CACHE_PREFIX = 'claude_cache_';
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

// In-memory cache for current session (faster lookups)
const memoryCache = new Map<string, { value: string; timestamp: number }>();

// Rate limiting for API tier
let lastCallTime = 0;
const MIN_CALL_INTERVAL = 100; // 100ms between calls

const hashPrompt = (prompt: string): string => {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
};

// Try to get from localStorage
const getFromStorage = (key: string): string | null => {
  try {
    const stored = localStorage.getItem(CACHE_PREFIX + key);
    if (stored) {
      const { value, timestamp } = JSON.parse(stored);
      if (Date.now() - timestamp < CACHE_TTL) {
        return value;
      }
      // Expired, remove it
      localStorage.removeItem(CACHE_PREFIX + key);
    }
  } catch {
    // localStorage not available or parse error
  }
  return null;
};

// Save to localStorage
const saveToStorage = (key: string, value: string): void => {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
      value,
      timestamp: Date.now(),
    }));
  } catch {
    // localStorage full or not available - that's okay
  }
};

// Clean up old cache entries periodically
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
    // Ignore errors
  }
};

// Run cleanup on load
cleanupOldCache();

/**
 * Robust JSON extraction from Claude responses
 * Handles: raw JSON, markdown code blocks, thinking tokens, whitespace
 */
export const extractJSON = (text: string): any | null => {
  if (!text || typeof text !== 'string') return null;
  
  // Log raw response for debugging
  console.log('extractJSON input:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
  
  // Try multiple extraction strategies
  let jsonStr: string | null = null;
  
  // Strategy 1: Look for ```json ... ``` code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }
  
  // Strategy 2: Look for raw JSON object
  if (!jsonStr) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
  }
  
  // Strategy 3: Look for JSON array
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
  
  // Clean up common issues
  jsonStr = jsonStr
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width chars
    .replace(/^\s+|\s+$/g, '') // Trim whitespace
    .replace(/,\s*([}\]])/g, '$1'); // Remove trailing commas
  
  try {
    const parsed = JSON.parse(jsonStr);
    console.log('extractJSON success:', parsed);
    return parsed;
  } catch (e) {
    console.error('extractJSON parse error:', e, 'Input was:', jsonStr.substring(0, 150));
    return null;
  }
};

/**
 * Call Claude API using Messages API format
 * @param prompt - The user prompt
 * @param systemPrompt - Optional system prompt for setting context/role
 * @param model - Model to use (default: claude-sonnet-4-5)
 */
export const callClaude = async (
  prompt: string,
  systemPrompt?: string,
  model: string = 'claude-sonnet-4-5'
): Promise<string | null> => {
  const cacheKey = hashPrompt(prompt + (systemPrompt || ''));
  
  // Check memory cache first (fastest)
  const memoryCached = memoryCache.get(cacheKey);
  if (memoryCached && Date.now() - memoryCached.timestamp < CACHE_TTL) {
    console.log('Claude: memory cache hit');
    return memoryCached.value;
  }
  
  // Check localStorage cache (persists across sessions)
  const storageCached = getFromStorage(cacheKey);
  if (storageCached) {
    console.log('Claude: storage cache hit');
    // Also add to memory cache for faster future lookups
    memoryCache.set(cacheKey, { value: storageCached, timestamp: Date.now() });
    return storageCached;
  }

  // Rate limiting
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;
  if (timeSinceLastCall < MIN_CALL_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_CALL_INTERVAL - timeSinceLastCall));
  }
  lastCallTime = Date.now();

  if (!CLAUDE_API_KEY) {
    console.error('Claude API key is missing. Check VITE_CLAUDE_API_KEY environment variable.');
    return null;
  }

  try {
    // Validate prompt length
    if (prompt.length > 1000000) {
      console.error('Prompt too long:', prompt.length);
      throw new Error('Prompt exceeds maximum length');
    }

    const requestBody: any = {
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    // Add system prompt if provided
    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    const apiUrl = 'https://api.anthropic.com/v1/messages';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      console.error('Claude API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        model: model,
        promptLength: prompt.length,
      });
      
      throw new Error(`Claude API ${response.status}: ${errorData.error?.message || errorData.message || errorText}`);
    }

    const data = await response.json();
    
    // Extract text from Claude's response format
    const result = data.content?.[0]?.text || null;
    
    if (!result) {
      console.error('Claude API returned empty result:', data);
      return null;
    }
    
    // Cache successful responses in both memory and storage
    memoryCache.set(cacheKey, { value: result, timestamp: Date.now() });
    saveToStorage(cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('Claude API call failed:', error);
    return null;
  }
};

/**
 * Call Claude expecting JSON response with automatic validation and retry
 * Uses structured prompting with XML tags for better results
 */
export const callClaudeForJSON = async <T = any>(
  prompt: string,
  systemPrompt?: string,
  maxRetries: number = 2
): Promise<T | null> => {
  console.log('callClaudeForJSON: Starting with prompt length:', prompt.length);
  
  // First attempt
  const response = await callClaude(prompt, systemPrompt);
  if (!response) {
    console.error('callClaudeForJSON: No response from Claude');
    return null;
  }
  
  console.log('callClaudeForJSON: Raw response:', response);
  
  // Try to extract JSON
  let parsed = extractJSON(response);
  if (parsed) {
    console.log('callClaudeForJSON: Success on first attempt');
    return parsed as T;
  }
  
  // First attempt failed - try repair/retry
  console.log('callClaudeForJSON: First attempt failed, trying repair...');
  
  for (let retry = 0; retry < maxRetries; retry++) {
    console.log(`callClaudeForJSON: Retry ${retry + 1}/${maxRetries}`);
    
    // Build a repair prompt using Claude's preferred XML structure
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
    
    const repairSystemPrompt = 'You are a JSON repair specialist. Your only job is to fix malformed JSON and output valid JSON.';
    
    const retryResponse = await callClaude(repairPrompt, repairSystemPrompt);
    if (!retryResponse) continue;
    
    console.log('callClaudeForJSON: Retry response:', retryResponse);
    
    parsed = extractJSON(retryResponse);
    if (parsed) {
      console.log('callClaudeForJSON: Success on retry', retry + 1);
      return parsed as T;
    }
  }
  
  console.error('callClaudeForJSON: All retries failed');
  return null;
};

// Batch multiple prompts into a single context for efficiency
export const callClaudeBatch = async (prompts: { id: string; prompt: string; systemPrompt?: string }[]): Promise<Map<string, string | null>> => {
  const results = new Map<string, string | null>();
  
  // Check cache for each prompt first
  const uncachedPrompts: { id: string; prompt: string; systemPrompt?: string }[] = [];
  
  for (const { id, prompt, systemPrompt } of prompts) {
    const cacheKey = hashPrompt(prompt + (systemPrompt || ''));
    const memoryCached = memoryCache.get(cacheKey);
    if (memoryCached && Date.now() - memoryCached.timestamp < CACHE_TTL) {
      results.set(id, memoryCached.value);
      continue;
    }
    const storageCached = getFromStorage(cacheKey);
    if (storageCached) {
      memoryCache.set(cacheKey, { value: storageCached, timestamp: Date.now() });
      results.set(id, storageCached);
      continue;
    }
    uncachedPrompts.push({ id, prompt, systemPrompt });
  }
  
  // If all cached, return early
  if (uncachedPrompts.length === 0) {
    console.log('Claude batch: all from cache');
    return results;
  }
  
  // For uncached prompts, make individual calls with concurrency limit
  const CONCURRENCY = 3;
  
  for (let i = 0; i < uncachedPrompts.length; i += CONCURRENCY) {
    const batch = uncachedPrompts.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async ({ id, prompt, systemPrompt }) => {
        const result = await callClaude(prompt, systemPrompt);
        return { id, result };
      })
    );
    
    batchResults.forEach(({ id, result }) => {
      results.set(id, result);
    });
  }
  
  return results;
};
