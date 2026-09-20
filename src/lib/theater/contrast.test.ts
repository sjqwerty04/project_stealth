import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

function themeColor(name: string): string {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9A-Fa-f]{6});`).exec(CSS);
  if (!match) throw new Error(`--color-${name} is missing from src/index.css`);
  return match[1];
}

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return Math.round(ratio * 100) / 100;
}

function ratio(foreground: string, background: string): number {
  return contrast(themeColor(foreground), themeColor(background));
}

describe('Theater surface contrast', () => {
  it('holds the token values the archive, Library rows, and You stats are drawn with', () => {
    expect(themeColor('base')).toBe('#0A0A0B');
    expect(themeColor('base-2')).toBe('#141416');
    expect(themeColor('base-3')).toBe('#1D1D20');
    expect(themeColor('line')).toBe('#2B2B2F');
    expect(themeColor('fg')).toBe('#EFEDE9');
    expect(themeColor('fg-2')).toBe('#B9B6B0');
    expect(themeColor('fg-3')).toBe('#7C7A76');
    expect(themeColor('select')).toBe('#FF3B14');
  });

  it('clears AA for every text pair the archive card and Library rows use on Surface/raised', () => {
    expect(ratio('fg', 'base-2')).toBe(15.74);
    expect(ratio('fg-2', 'base-2')).toBe(9.09);
    expect(ratio('select', 'base-2')).toBe(5.16);
    for (const foreground of ['fg', 'fg-2', 'select']) {
      expect(ratio(foreground, 'base-2')).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('clears AA for every text pair the archive chrome and You stats use on Surface/base', () => {
    expect(ratio('fg', 'base')).toBe(16.93);
    expect(ratio('fg-2', 'base')).toBe(9.78);
    expect(ratio('fg-3', 'base')).toBe(4.62);
    expect(ratio('select', 'base')).toBe(5.55);
    for (const foreground of ['fg', 'fg-2', 'fg-3', 'select']) {
      expect(ratio(foreground, 'base')).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('clears AA for the Keep button, which prints Surface/base on Text/primary', () => {
    expect(ratio('base', 'fg')).toBe(16.93);
  });

  it('proves Text/tertiary misses AA on Surface/raised, which is why card metadata uses Text/secondary', () => {
    expect(ratio('fg-3', 'base-2')).toBe(4.3);
    expect(ratio('fg-3', 'base-2')).toBeLessThan(4.5);
  });
});
