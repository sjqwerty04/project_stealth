import { describe, expect, it, vi } from 'vitest';
import { swatchesFrom } from './infer';
import {
  browserImageDeps,
  dominantPosterColor,
  imagePosterSampler,
  posterColorsFrom,
  posterSampleUrl,
  POSTER_LOAD_TIMEOUT_MS,
  POSTER_SAMPLE_PX,
  type PosterImageDeps,
  type PosterPixels,
} from './posterColor';
import { FALLBACK_SWATCHES } from './types';

const OPAQUE = 255;

function pixels(...rows: [number, number, number, number][]): number[] {
  return rows.flat();
}

function repeat(row: [number, number, number, number], times: number): [number, number, number, number][] {
  return Array.from({ length: times }, () => row);
}

const SODIUM: [number, number, number, number] = [200, 140, 40, OPAQUE];
const CYAN: [number, number, number, number] = [40, 120, 160, OPAQUE];

describe('dominantPosterColor', () => {
  it('reads one flat colour back as its own six-digit hex', () => {
    expect(dominantPosterColor(pixels(SODIUM, SODIUM, SODIUM))).toBe('#c88c28');
  });

  it('pads a single-digit channel to two places', () => {
    expect(dominantPosterColor(pixels([9, 200, 40, OPAQUE]))).toBe('#09c828');
  });

  it('answers with the fullest colour cell, not the mean of the whole poster', () => {
    const mostlySodium = pixels(...repeat(SODIUM, 9), ...repeat(CYAN, 4));
    expect(dominantPosterColor(mostlySodium)).toBe('#c88c28');
    const mostlyCyan = pixels(...repeat(SODIUM, 4), ...repeat(CYAN, 9));
    expect(dominantPosterColor(mostlyCyan)).toBe('#2878a0');
  });

  it('averages inside the winning cell so near neighbours land together', () => {
    const neighbours = pixels([200, 140, 40, OPAQUE], [204, 142, 44, OPAQUE], [40, 120, 160, OPAQUE]);
    expect(dominantPosterColor(neighbours)).toBe('#ca8d2a');
  });

  it('breaks a tie on the lower colour cell, whatever order the pixels arrive in', () => {
    expect(dominantPosterColor(pixels(SODIUM, CYAN))).toBe('#2878a0');
    expect(dominantPosterColor(pixels(CYAN, SODIUM))).toBe('#2878a0');
  });

  it('skips transparent and half-transparent pixels', () => {
    expect(dominantPosterColor(pixels([200, 140, 40, 0], CYAN))).toBe('#2878a0');
    expect(dominantPosterColor(pixels([200, 140, 40, 199], CYAN))).toBe('#2878a0');
    expect(dominantPosterColor(pixels([200, 140, 40, 200]))).toBe('#c88c28');
  });

  it('skips black bars and blown-out white', () => {
    expect(dominantPosterColor(pixels([0, 0, 0, OPAQUE], [24, 24, 24, OPAQUE], CYAN))).toBe('#2878a0');
    expect(dominantPosterColor(pixels([255, 255, 255, OPAQUE], [232, 232, 232, OPAQUE], CYAN))).toBe('#2878a0');
    expect(dominantPosterColor(pixels([25, 25, 25, OPAQUE]))).toBe('#191919');
    expect(dominantPosterColor(pixels([231, 231, 231, OPAQUE]))).toBe('#e7e7e7');
  });

  it('answers with no colour when nothing survives the skips', () => {
    expect(dominantPosterColor([])).toBeNull();
    expect(dominantPosterColor(pixels([0, 0, 0, OPAQUE], [255, 255, 255, OPAQUE], [200, 140, 40, 0]))).toBeNull();
    expect(dominantPosterColor([200, 140, 40])).toBeNull();
    expect(dominantPosterColor(pixels([Number.NaN, 140, 40, OPAQUE]))).toBeNull();
  });

  it('clamps a channel outside the byte range', () => {
    expect(dominantPosterColor(pixels([300, 140, -20, OPAQUE]))).toBe('#ff8c00');
  });
});

describe('posterSampleUrl', () => {
  it('names the TMDB poster at the sampling size', () => {
    expect(posterSampleUrl('/thief.jpg')).toBe('https://image.tmdb.org/t/p/w92/thief.jpg');
  });
});

describe('posterColorsFrom', () => {
  const lineup = [
    { posterPath: '/samourai.jpg' },
    { posterPath: '/tlad.jpg' },
    { posterPath: '/collateral.jpg' },
    { posterPath: '/eddie.jpg' },
    { posterPath: '/sorcerer.jpg' },
  ];

  const palette: Record<string, string> = {
    'https://image.tmdb.org/t/p/w92/samourai.jpg': '#0b3d91',
    'https://image.tmdb.org/t/p/w92/tlad.jpg': '#7a1f1f',
    'https://image.tmdb.org/t/p/w92/collateral.jpg': '#2878a0',
    'https://image.tmdb.org/t/p/w92/eddie.jpg': '#3d3d42',
    'https://image.tmdb.org/t/p/w92/sorcerer.jpg': '#5a3b12',
  };

  it('samples the first four posters and never the fifth', async () => {
    const asked: string[] = [];
    const colors = await posterColorsFrom(async (url) => {
      asked.push(url);
      return palette[url] ?? null;
    })(lineup);
    expect(colors).toEqual(['#0b3d91', '#7a1f1f', '#2878a0', '#3d3d42']);
    expect(asked).toEqual([
      'https://image.tmdb.org/t/p/w92/samourai.jpg',
      'https://image.tmdb.org/t/p/w92/tlad.jpg',
      'https://image.tmdb.org/t/p/w92/collateral.jpg',
      'https://image.tmdb.org/t/p/w92/eddie.jpg',
    ]);
    expect(swatchesFrom(colors)).toEqual(['#0b3d91', '#7a1f1f', '#2878a0', '#3d3d42']);
  });

  it('skips a film with no poster and reaches further down the lineup', async () => {
    const colors = await posterColorsFrom(async (url) => palette[url] ?? null)([
      { posterPath: null },
      ...lineup.slice(0, 4),
    ]);
    expect(colors).toEqual(['#0b3d91', '#7a1f1f', '#2878a0', '#3d3d42']);
  });

  it('drops a refused poster so the fallback palette finishes the strip', async () => {
    const colors = await posterColorsFrom(async (url) =>
      url.includes('tlad') || url.includes('eddie') ? null : palette[url] ?? null,
    )(lineup);
    expect(colors).toEqual(['#0b3d91', '#2878a0']);
    expect(swatchesFrom(colors)).toEqual([
      '#0b3d91',
      '#2878a0',
      FALLBACK_SWATCHES[2],
      FALLBACK_SWATCHES[3],
    ]);
  });

  it('drops a thrown sample and keeps the rest', async () => {
    const colors = await posterColorsFrom(async (url) => {
      if (url.includes('samourai')) throw new Error('SecurityError');
      return palette[url] ?? null;
    })(lineup);
    expect(colors).toEqual(['#7a1f1f', '#2878a0', '#3d3d42']);
    expect(swatchesFrom(colors)).toEqual(['#7a1f1f', '#2878a0', '#3d3d42', FALLBACK_SWATCHES[3]]);
  });

  it('drops a sample that answers with something other than a six-digit hex', async () => {
    const colors = await posterColorsFrom(async () => 'rgb(11, 61, 145)')(lineup);
    expect(colors).toEqual([]);
    expect(swatchesFrom(colors)).toEqual(FALLBACK_SWATCHES);
  });

  it('leaves a posterless lineup on the verified fallback', async () => {
    const colors = await posterColorsFrom(async () => '#0b3d91')([{ posterPath: null }, { posterPath: null }]);
    expect(colors).toEqual([]);
    expect(swatchesFrom(colors)).toEqual(FALLBACK_SWATCHES);
  });
});

type FakeImage = HTMLImageElement & { crossOrigin: string | null; src: string };

function imageHarness(pixelsFor: (image: FakeImage) => PosterPixels | null | 'throw') {
  const images: FakeImage[] = [];
  const timers: { run: () => void; ms: number; cancelled: boolean }[] = [];
  const canvases: { width: number; height: number; args: unknown[] }[] = [];
  const deps: PosterImageDeps = {
    createImage: () => {
      const image = { crossOrigin: null, src: '', onload: null, onerror: null } as unknown as FakeImage;
      images.push(image);
      return image;
    },
    createCanvas: () => {
      const canvas = { width: 0, height: 0, args: [] as unknown[] };
      canvases.push(canvas);
      return {
        set width(value: number) {
          canvas.width = value;
        },
        get width() {
          return canvas.width;
        },
        set height(value: number) {
          canvas.height = value;
        },
        get height() {
          return canvas.height;
        },
        getContext: () => ({
          drawImage: (...args: unknown[]) => canvas.args.push(...args),
          getImageData: () => {
            const image = images[canvases.indexOf(canvas)];
            const data = pixelsFor(image);
            if (data === 'throw') throw new Error('SecurityError: tainted canvas');
            return { data };
          },
        }),
      } as unknown as HTMLCanvasElement;
    },
    schedule: (run, ms) => {
      const timer = { run, ms, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
  };
  return { deps, images, timers, canvases };
}

describe('imagePosterSampler', () => {
  it('loads the poster cross-origin, draws it small, and answers with its dominant colour', async () => {
    const harness = imageHarness(() => pixels(...repeat(SODIUM, 9), ...repeat(CYAN, 4)));
    const pending = imagePosterSampler(harness.deps)('https://image.tmdb.org/t/p/w92/thief.jpg');
    const [image] = harness.images;
    expect(image.src).toBe('https://image.tmdb.org/t/p/w92/thief.jpg');
    expect(image.crossOrigin).toBe('anonymous');
    image.onload?.(new Event('load'));
    expect(await pending).toBe('#c88c28');
    expect(harness.canvases[0]).toEqual({
      width: POSTER_SAMPLE_PX,
      height: POSTER_SAMPLE_PX,
      args: [image, 0, 0, POSTER_SAMPLE_PX, POSTER_SAMPLE_PX],
    });
    expect(harness.timers[0].cancelled).toBe(true);
  });

  it('answers with no colour when the image fails to load', async () => {
    const harness = imageHarness(() => null);
    const pending = imagePosterSampler(harness.deps)('https://image.tmdb.org/t/p/w92/missing.jpg');
    harness.images[0].onerror?.(new Event('error'));
    expect(await pending).toBeNull();
    expect(harness.canvases).toEqual([]);
  });

  it('answers with no colour when CORS taints the canvas', async () => {
    const harness = imageHarness(() => 'throw');
    const pending = imagePosterSampler(harness.deps)('https://image.tmdb.org/t/p/w92/tainted.jpg');
    harness.images[0].onload?.(new Event('load'));
    expect(await pending).toBeNull();
  });

  it('answers with no colour when the poster carries nothing worth sampling', async () => {
    const harness = imageHarness(() => pixels([0, 0, 0, OPAQUE], [255, 255, 255, OPAQUE]));
    const pending = imagePosterSampler(harness.deps)('https://image.tmdb.org/t/p/w92/black.jpg');
    harness.images[0].onload?.(new Event('load'));
    expect(await pending).toBeNull();
  });

  it('gives up on a poster that never loads and never answers twice', async () => {
    const harness = imageHarness(() => pixels(SODIUM));
    const pending = imagePosterSampler(harness.deps)('https://image.tmdb.org/t/p/w92/hangs.jpg');
    expect(harness.timers[0].ms).toBe(POSTER_LOAD_TIMEOUT_MS);
    harness.timers[0].run();
    expect(await pending).toBeNull();
    harness.images[0].onload?.(new Event('load'));
    expect(await pending).toBeNull();
  });

  it('answers with no colour for every poster off a browser', async () => {
    vi.stubGlobal('document', undefined);
    expect(browserImageDeps()).toBeNull();
    expect(await imagePosterSampler(null)('https://image.tmdb.org/t/p/w92/thief.jpg')).toBeNull();
    vi.unstubAllGlobals();
  });
});
