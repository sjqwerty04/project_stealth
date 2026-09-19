import { describe, expect, it } from 'vitest';
import { DEFAULT_COLOUR, hexToOklab, oklabCentroid, oklabToHex, paletteFrom, parseHex, samplePosterColours } from './colour';

describe('oklab round trip', () => {
  const samples = ['#000000', '#FFFFFF', '#3A6E85', '#FF3B14', '#123456', '#ABCDEF', '#7C7A76', '#0f0'];
  it.each(samples)('round trips %s within 1/255 per channel', (hex) => {
    const back = oklabToHex(hexToOklab(hex));
    const a = parseHex(hex)!;
    const b = parseHex(back)!;
    for (let i = 0; i < 3; i++) expect(Math.abs(a[i] - b[i])).toBeLessThanOrEqual(1);
  });

  it('returns uppercase six digit hex', () => {
    expect(oklabToHex(hexToOklab('#abcdef'))).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe('oklabCentroid', () => {
  it('falls back to the house blue when empty', () => {
    expect(oklabCentroid([])).toBe(DEFAULT_COLOUR);
    expect(oklabCentroid(['nope', ''])).toBe(DEFAULT_COLOUR);
  });

  it('averages red and blue into a purple', () => {
    const hex = oklabCentroid(['#FF0000', '#0000FF']);
    expect(hex).toBe('#8C53A2');
    const [r, g, b] = parseHex(hex)!;
    expect(r).toBeGreaterThan(g);
    expect(b).toBeGreaterThan(g);
  });

  it('returns the same colour for a single input', () => {
    expect(oklabCentroid(['#3A6E85'])).toBe('#3A6E85');
  });
});

describe('paletteFrom', () => {
  it('yields five distinct swatches ending in the accent', () => {
    const p = paletteFrom('#3A6E85');
    expect(p).toHaveLength(5);
    expect(new Set(p).size).toBe(5);
    expect(p[4]).toBe('#FF3B14');
  });
});

describe('samplePosterColours', () => {
  const urls = Array.from({ length: 10 }, (_, i) => `https://x/${i}.jpg`);

  it('respects the cap and reports progress once per sampled poster', async () => {
    const seen: [number, number][] = [];
    const calls: string[] = [];
    const out = await samplePosterColours(urls, {
      cap: 4,
      concurrency: 2,
      onProgress: (d, t) => seen.push([d, t]),
      extract: async (u) => {
        calls.push(u);
        return '#112233';
      },
    });
    expect(out).toEqual(['#112233', '#112233', '#112233', '#112233']);
    expect(calls).toHaveLength(4);
    expect(seen).toHaveLength(4);
    expect(seen.map((s) => s[1])).toEqual([4, 4, 4, 4]);
    expect(seen[3][0]).toBe(4);
  });

  it('skips failures and junk but still counts them as progress', async () => {
    let n = 0;
    const seen: number[] = [];
    const out = await samplePosterColours(urls.slice(0, 3), {
      onProgress: (d) => seen.push(d),
      extract: async () => {
        n++;
        if (n === 1) throw new Error('boom');
        if (n === 2) return 'not-a-colour';
        return '#ABCDEF';
      },
    });
    expect(out).toEqual(['#ABCDEF']);
    expect(seen).toEqual([1, 2, 3]);
  });

  it('returns empty and never reports for no urls', async () => {
    const seen: number[] = [];
    const out = await samplePosterColours([], { onProgress: (d) => seen.push(d), extract: async () => '#000000' });
    expect(out).toEqual([]);
    expect(seen).toEqual([]);
  });
});
