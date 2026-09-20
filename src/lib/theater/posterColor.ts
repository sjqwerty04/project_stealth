import { isHexColor, type TheaterFilm } from './types';

export const POSTER_SAMPLE_COUNT = 4;

export const POSTER_SAMPLE_PX = 16;

/** Swatches are decorative, so a slow CDN gives up its turn rather than holding the Theater reveal. */
export const POSTER_LOAD_TIMEOUT_MS = 1200;

const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w92';

const MIN_OPAQUE_ALPHA = 200;
const MIN_BRIGHTNESS = 24;
const MAX_BRIGHTNESS = 232;
const BUCKET_SHIFT = 5;

export type PosterPixels = ArrayLike<number>;

type Bucket = { count: number; r: number; g: number; b: number };

function channel(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.min(255, Math.max(0, Math.round(value)));
}

function bucketKey(r: number, g: number, b: number): number {
  return ((r >> BUCKET_SHIFT) << 10) | ((g >> BUCKET_SHIFT) << 5) | (b >> BUCKET_SHIFT);
}

function hex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export function dominantPosterColor(pixels: PosterPixels): string | null {
  const buckets = new Map<number, Bucket>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const r = channel(pixels[i]);
    const g = channel(pixels[i + 1]);
    const b = channel(pixels[i + 2]);
    const alpha = channel(pixels[i + 3]);
    if (r === null || g === null || b === null || alpha === null || alpha < MIN_OPAQUE_ALPHA) continue;
    const brightness = (r + g + b) / 3;
    if (brightness <= MIN_BRIGHTNESS || brightness >= MAX_BRIGHTNESS) continue;
    const key = bucketKey(r, g, b);
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    buckets.set(key, { count: bucket.count + 1, r: bucket.r + r, g: bucket.g + g, b: bucket.b + b });
  }
  let bestKey = -1;
  let best: Bucket | null = null;
  for (const [key, bucket] of buckets) {
    if (!best || bucket.count > best.count || (bucket.count === best.count && key < bestKey)) {
      bestKey = key;
      best = bucket;
    }
  }
  if (!best) return null;
  const color = hex(
    Math.round(best.r / best.count),
    Math.round(best.g / best.count),
    Math.round(best.b / best.count),
  );
  return isHexColor(color) ? color : null;
}

export function posterSampleUrl(posterPath: string): string {
  return `${TMDB_POSTER_BASE}${posterPath}`;
}

export type PosterSampler = (url: string) => Promise<string | null>;

export type PosterColors = (films: readonly Pick<TheaterFilm, 'posterPath'>[]) => Promise<string[]>;

export function posterColorsFrom(sample: PosterSampler, count = POSTER_SAMPLE_COUNT): PosterColors {
  return async (films) => {
    const paths = films
      .flatMap((film) => (film.posterPath ? [film.posterPath] : []))
      .slice(0, count);
    const sampled = await Promise.all(
      paths.map((path) => sample(posterSampleUrl(path)).catch(() => null)),
    );
    return sampled.filter(isHexColor);
  };
}

export type PosterImageDeps = {
  createImage: () => HTMLImageElement;
  createCanvas: () => HTMLCanvasElement;
  schedule: (run: () => void, ms: number) => () => void;
};

export function browserImageDeps(): PosterImageDeps | null {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  return {
    createImage: () => new Image(),
    createCanvas: () => document.createElement('canvas'),
    schedule: (run, ms) => {
      const timer = setTimeout(run, ms);
      return () => clearTimeout(timer);
    },
  };
}

function pixelsOf(image: HTMLImageElement, deps: PosterImageDeps): PosterPixels | null {
  try {
    const canvas = deps.createCanvas();
    canvas.width = POSTER_SAMPLE_PX;
    canvas.height = POSTER_SAMPLE_PX;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0, POSTER_SAMPLE_PX, POSTER_SAMPLE_PX);
    // A poster served without CORS headers taints the canvas, and getImageData throws on a tainted one.
    return context.getImageData(0, 0, POSTER_SAMPLE_PX, POSTER_SAMPLE_PX).data;
  } catch {
    return null;
  }
}

export function imagePosterSampler(deps: PosterImageDeps | null = browserImageDeps()): PosterSampler {
  if (!deps) return async () => null;
  return (url) =>
    new Promise((resolve) => {
      const image = deps.createImage();
      let cancelTimeout: (() => void) | null = null;
      let settled = false;
      const settle = (color: string | null) => {
        if (settled) return;
        settled = true;
        cancelTimeout?.();
        resolve(color);
      };
      image.onload = () => {
        const pixels = pixelsOf(image, deps);
        settle(pixels ? dominantPosterColor(pixels) : null);
      };
      image.onerror = () => settle(null);
      cancelTimeout = deps.schedule(() => settle(null), POSTER_LOAD_TIMEOUT_MS);
      image.crossOrigin = 'anonymous';
      image.src = url;
    });
}

export function theaterPosterColors(sampler: PosterSampler = imagePosterSampler()): PosterColors {
  return posterColorsFrom(sampler);
}
