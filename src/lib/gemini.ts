const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Persistent cache using localStorage for longer-term storage
const CACHE_PREFIX = 'gemini_cache_';
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

// In-memory cache for current session (faster lookups)
const memoryCache = new Map<string, { value: string; timestamp: number }>();

// Rate limiting for paid tier (much more generous)
let lastCallTime = 0;
const MIN_CALL_INTERVAL = 100; // 100ms between calls (paid tier can handle 1000+/min)

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
 * Robust JSON extraction from Gemini responses
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
    // Try to repair truncated JSON
    console.log('extractJSON: Attempting to repair truncated JSON...');
    
    let repaired = jsonStr;
    
    // Repair strategy 1: Recommendation format - truncated at "from
    if (repaired.includes('"from') && !repaired.includes('fromWatchlist')) {
      repaired = repaired.replace(/"from$/, '"fromWatchlist":false}');
    }
    
    // Repair strategy 2: Orbit format - truncated "reason" field (at the end)
    // Pattern: {"title":"X","year":"Y","hex":"#Z","score":N,"reason":"...
    if (repaired.includes('"reason":"') && !repaired.endsWith('}')) {
      // Find where reason starts and add closing
      const reasonIndex = repaired.lastIndexOf('"reason":"');
      if (reasonIndex !== -1) {
        // Check if there's an unclosed string after "reason":"
        const afterReason = repaired.substring(reasonIndex + 10);
        if (!afterReason.includes('"}')) {
          // Truncated mid-reason, close it
          repaired = repaired + '"}';
        }
      }
    }
    
    // Repair strategy 3: Truncated score (numeric field)
    // Pattern: "score": without complete value
    if (repaired.includes('"score":') && !repaired.includes('"reason"')) {
      repaired = repaired.replace(/"score":\s*$/, '"score":75,"reason":""}');
    }
    
    // Repair strategy 4: Generic - missing closing brace
    if (!repaired.endsWith('}')) {
      // Count braces to see if we need to close
      const openBraces = (repaired.match(/{/g) || []).length;
      const closeBraces = (repaired.match(/}/g) || []).length;
      if (openBraces > closeBraces) {
        // Check if we're mid-string
        const lastQuote = repaired.lastIndexOf('"');
        const lastColon = repaired.lastIndexOf(':');
        if (lastQuote > lastColon) {
          // Mid-string value, close it
          repaired = repaired + '"}';
        } else {
          // After a colon, add empty value
          repaired = repaired + '""}';
        }
      }
    }
    
    try {
      const parsed = JSON.parse(repaired);
      console.log('extractJSON repaired success:', parsed);
      return parsed;
    } catch {
      console.error('extractJSON parse error after repair:', 'Input was:', jsonStr.substring(0, 150));
      return null;
    }
  }
};

export const callGemini = async (prompt: string, model: string = 'gemini-3-flash-preview'): Promise<string | null> => {
  const cacheKey = hashPrompt(prompt);
  
  // Check memory cache first (fastest)
  const memoryCached = memoryCache.get(cacheKey);
  if (memoryCached && Date.now() - memoryCached.timestamp < CACHE_TTL) {
    console.log('Gemini: memory cache hit');
    return memoryCached.value;
  }
  
  // Check localStorage cache (persists across sessions)
  const storageCached = getFromStorage(cacheKey);
  if (storageCached) {
    console.log('Gemini: storage cache hit');
    // Also add to memory cache for faster future lookups
    memoryCache.set(cacheKey, { value: storageCached, timestamp: Date.now() });
    return storageCached;
  }

  // Rate limiting (light touch for paid tier)
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;
  if (timeSinceLastCall < MIN_CALL_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_CALL_INTERVAL - timeSinceLastCall));
  }
  lastCallTime = Date.now();

  if (!GEMINI_API_KEY) {
    console.error('Gemini API key is missing. Check Vercel environment variables.');
    console.error('Current env check:', {
      hasKey: !!import.meta.env.VITE_GEMINI_API_KEY,
      keyLength: import.meta.env.VITE_GEMINI_API_KEY?.length || 0,
      keyPrefix: import.meta.env.VITE_GEMINI_API_KEY?.substring(0, 10) || 'none'
    });
    return null;
  }

  try {
    // Validate prompt length (Gemini has token limits)
    if (prompt.length > 1000000) { // Rough estimate: 1M chars ≈ 250k tokens
      console.error('Prompt too long:', prompt.length);
      throw new Error('Prompt exceeds maximum length');
    }

    const requestBody: any = { 
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 1.0, // Gemini 3 default - recommended
        maxOutputTokens: 1024, // Increased from 500 to prevent JSON truncation
      }
    };
    // NOTE: thinkingConfig removed - it was causing response format issues with JSON outputs

    // Validate request body can be stringified
    let requestBodyString;
    try {
      requestBodyString = JSON.stringify(requestBody);
    } catch (e) {
      console.error('Failed to stringify request body:', e);
      throw new Error('Invalid request body');
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBodyString,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      // Log full error details for debugging
      console.error('Gemini API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        model: model,
        promptLength: prompt.length,
        promptPreview: prompt.substring(0, 200) + '...'
      });
      
      // If 3-flash fails with 400, try 2.5-flash-lite as fallback (without thinkingConfig)
      if (response.status === 400 && model === 'gemini-3-flash-preview') {
        console.log('Gemini 3 failed with 400, retrying with gemini-2.5-flash-lite as fallback...');
        // Retry without thinkingConfig (2.5 doesn't support it)
        const fallbackBody = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 1.0,
            maxOutputTokens: 1024,
          }
        };
        
        try {
          const fallbackResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(fallbackBody),
            }
          );
          
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            const result = fallbackData.candidates?.[0]?.content?.parts?.[0]?.text || null;
            if (result) {
              // Cache the successful fallback response
              memoryCache.set(cacheKey, { value: result, timestamp: Date.now() });
              saveToStorage(cacheKey, result);
              return result;
            }
          }
        } catch (fallbackError) {
          console.error('Fallback to gemini-2.5-flash-lite also failed:', fallbackError);
        }
      }
      
      // Throw error with details so caller can handle it
      throw new Error(`Gemini API ${response.status}: ${errorData.error?.message || errorData.message || errorText}`);
    }

    const data = await response.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    
    if (!result) {
      console.error('Gemini API returned empty result:', data);
      return null;
    }
    
    // Cache successful responses in both memory and storage
    memoryCache.set(cacheKey, { value: result, timestamp: Date.now() });
    saveToStorage(cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('Gemini API call failed:', error);
    return null;
  }
};

// Batch multiple prompts into a single context for efficiency
export const callGeminiBatch = async (prompts: { id: string; prompt: string }[]): Promise<Map<string, string | null>> => {
  const results = new Map<string, string | null>();
  
  // Check cache for each prompt first
  const uncachedPrompts: { id: string; prompt: string }[] = [];
  
  for (const { id, prompt } of prompts) {
    const cacheKey = hashPrompt(prompt);
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
    uncachedPrompts.push({ id, prompt });
  }
  
  // If all cached, return early
  if (uncachedPrompts.length === 0) {
    console.log('Gemini batch: all from cache');
    return results;
  }
  
  // For uncached prompts, make individual calls (Gemini doesn't support true batching)
  // But we can run them in parallel with a small concurrency limit
  const CONCURRENCY = 3;
  
  for (let i = 0; i < uncachedPrompts.length; i += CONCURRENCY) {
    const batch = uncachedPrompts.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async ({ id, prompt }) => {
        const result = await callGemini(prompt);
        return { id, result };
      })
    );
    
    batchResults.forEach(({ id, result }) => {
      results.set(id, result);
    });
  }
  
  return results;
};

// Pre-warm cache for a movie (call in background)
export const preWarmMovieCache = async (movieTitle: string, movieYear: string, genres: string[]): Promise<void> => {
  const vibePrompt = `You're a witty film critic. Describe the VIBE of "${movieTitle}" (${movieYear}) in 1-2 sentences.
Genres: ${genres.join(', ')}
Focus on mood, style, and tone - NOT plot. Be playful and specific.
DO NOT spoil anything. Keep it under 2 sentences.`;
  
  // Fire and forget - don't await
  callGemini(vibePrompt).catch(() => {});
};
