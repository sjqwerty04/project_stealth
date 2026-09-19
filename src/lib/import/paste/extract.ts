import { parseListText, type ListIntent, type ParsedItem, type ParsedList } from './heuristics';

export type ExtractSource = 'paste' | 'screenshot';

type ApiItem = { title: string; year?: string; stars?: number; struck?: boolean };
type ApiResult = { items: ApiItem[]; intent: ListIntent; confidence: number };

async function callExtract(body: { text?: string; images?: string[] }): Promise<ApiResult | null> {
  try {
    const res = await fetch('/api/list-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<ApiResult>;
    if (!Array.isArray(data.items)) return null;
    return {
      items: data.items,
      intent: data.intent === 'watched' || data.intent === 'watchlist' ? data.intent : 'unknown',
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
    };
  } catch {
    return null;
  }
}

function fromApi(result: ApiResult): ParsedList {
  const items: ParsedItem[] = result.items.map((i) => ({
    title: i.title,
    year: i.year,
    stars: i.stars,
    struck: i.struck === true,
    raw: i.title,
  }));
  return { items, intent: result.intent, confidence: result.confidence };
}

/** Heuristics first. The model only runs when the local guess is weak. */
export async function extractFromText(text: string): Promise<ParsedList> {
  const local = parseListText(text);
  if (local.items.length && local.confidence >= 0.6) return local;
  const remote = await callExtract({ text });
  if (!remote || !remote.items.length) return local;
  const merged = fromApi(remote);
  if (local.items.length >= merged.items.length) {
    return { ...local, intent: remote.intent, confidence: Math.max(local.confidence, remote.confidence) };
  }
  return merged;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Downscale to keep the payload small. Falls back to the raw data URL when canvas is unavailable. */
export async function shrinkImage(file: File, maxEdge = 1600): Promise<string> {
  const dataUrl = await fileToDataUrl(file);
  if (typeof document === 'undefined') return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      if (scale === 1) return resolve(dataUrl);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function extractFromImages(files: File[]): Promise<ParsedList | null> {
  const images = await Promise.all(files.slice(0, 4).map((f) => shrinkImage(f)));
  const remote = await callExtract({ images });
  return remote ? fromApi(remote) : null;
}
