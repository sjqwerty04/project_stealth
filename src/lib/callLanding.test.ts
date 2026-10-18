import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('public/call/index.html', 'utf8');
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
  rewrites: { source: string; destination: string }[];
};

function spaRewriteSource() {
  const spa = vercel.rewrites.find((rule) => rule.destination === '/index.html');
  if (!spa) throw new Error('missing SPA rewrite');
  return new RegExp(`^${spa.source}$`);
}

describe('call landing page', () => {
  it('is titled Call Selects and shows the formatted number', () => {
    expect(html).toContain('<title>Call Selects</title>');
    expect(html).toContain('content="Call Selects"');
    expect(html).toContain('(231) 525-7644');
    expect(html).toContain('src="/selects-logo.png"');
  });

  it('shows Call Selects only on the button, not as a page heading', () => {
    const body = html.slice(html.indexOf('<body>'));
    expect(body.match(/Call Selects/g)).toEqual(['Call Selects']);
    expect(body).not.toMatch(/<h1\b/);
    expect(body).toContain('>Call Selects</a>');
  });

  it('links the fallback button to the E.164 tel URI', () => {
    expect(html).toContain('href="tel:+12315257644"');
    expect(html).toContain("var TEL = 'tel:+12315257644'");
  });

  it('declares OG tags for the Instagram sticker preview', () => {
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('https://selectsfilm.com/call');
    expect(html).toContain('https://selectsfilm.com/selects-logo.png');
  });
});

describe('call route rewrites', () => {
  it('serves the static page ahead of the SPA catch-all', () => {
    expect(vercel.rewrites[0]).toEqual({ source: '/call', destination: '/call/index.html' });
    expect(vercel.rewrites[1]).toEqual({ source: '/call/', destination: '/call/index.html' });
  });

  it('keeps /call out of the SPA rewrite without touching other routes', () => {
    const spa = spaRewriteSource();
    expect(spa.test('/call')).toBe(false);
    expect(spa.test('/call/')).toBe(false);
    expect(spa.test('/api/llm')).toBe(false);
    expect(spa.test('/app')).toBe(true);
    expect(spa.test('/login')).toBe(true);
    expect(spa.test('/join')).toBe(true);
    expect(spa.test('/callback')).toBe(true);
  });
});
