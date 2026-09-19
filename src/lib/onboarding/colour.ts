export const DEFAULT_COLOUR = '#3A6E85';
export const ACCENT = '#FF3B14';

export type Oklab = [number, number, number];

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const v = clamp01(c);
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function hexToOklab(hex: string): Oklab {
  const rgb = parseHex(hex) ?? parseHex(DEFAULT_COLOUR)!;
  const r = srgbToLinear(rgb[0] / 255);
  const g = srgbToLinear(rgb[1] / 255);
  const b = srgbToLinear(rgb[2] / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToHex(lab: Oklab): string {
  const [L, a, bb] = lab;
  const l_ = L + 0.3963377774 * a + 0.2158037573 * bb;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bb;
  const s_ = L - 0.0894841775 * a - 1.291485548 * bb;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return toHex(linearToSrgb(r), linearToSrgb(g), linearToSrgb(b));
}

export function oklabCentroid(hexes: string[]): string {
  const valid = hexes.filter((h) => parseHex(h) !== null);
  if (valid.length === 0) return DEFAULT_COLOUR;
  const sum: Oklab = [0, 0, 0];
  for (const h of valid) {
    const lab = hexToOklab(h);
    sum[0] += lab[0];
    sum[1] += lab[1];
    sum[2] += lab[2];
  }
  return oklabToHex([sum[0] / valid.length, sum[1] / valid.length, sum[2] / valid.length]);
}

/** Five swatches spun off one base so a thin sample set still renders a varied graph. */
export function paletteFrom(baseHex: string): string[] {
  const [L, a, b] = hexToOklab(baseHex);
  return [
    oklabToHex([L, a, b]),
    oklabToHex([Math.min(0.95, L + 0.18), a, b]),
    oklabToHex([Math.max(0.15, L - 0.18), a, b]),
    oklabToHex([L, -a, -b]),
    ACCENT,
  ];
}

export type SampleOptions = {
  cap?: number;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
  extract?: (url: string) => Promise<string>;
};

async function defaultExtract(url: string): Promise<string> {
  // Lazy so the pure colour maths stays importable in node tests without dragging in the TMDB/LLM module.
  const mod = await import('../orbitEngine');
  // The PWA caches poster <img> loads as opaque responses. A canvas read needs a CORS response,
  // so the sampler asks for a URL the service worker has never seen.
  const corsUrl = url.includes('?') ? `${url}&cors=1` : `${url}?cors=1`;
  return mod.extractDominantColor(corsUrl);
}

export async function samplePosterColours(posterUrls: string[], opts: SampleOptions = {}): Promise<string[]> {
  const cap = opts.cap ?? 60;
  const concurrency = Math.max(1, opts.concurrency ?? 6);
  const extract = opts.extract ?? defaultExtract;
  const urls = posterUrls.filter((u) => typeof u === 'string' && u.length > 0).slice(0, cap);
  const total = urls.length;
  const results: (string | null)[] = new Array(total).fill(null);
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < total) {
      const i = next++;
      try {
        const hex = await extract(urls[i]);
        results[i] = parseHex(hex) ? hex : null;
      } catch {
        results[i] = null;
      }
      done++;
      opts.onProgress?.(done, total);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
  return results.filter((h): h is string => h !== null);
}
