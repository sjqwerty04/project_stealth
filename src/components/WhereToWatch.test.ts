import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import WhereToWatch from './WhereToWatch';
import { parseWatchProviders, whiteMarkKey, type WatchProviders } from '../lib/watchProviders';

const LINK = 'https://www.themoviedb.org/movie/680/watch?locale=US';

const PULP: WatchProviders = {
  link: LINK,
  stream: [
    { id: 119, name: 'Amazon Prime Video', logoPath: '/prime.jpg', priority: 1 },
    { id: 257, name: 'fuboTV', logoPath: '/fubo.jpg', priority: 2 },
    { id: 2303, name: 'Paramount Plus Premium', logoPath: '/p.jpg', priority: 3 },
    { id: 2304, name: 'Paramount Plus Essential', logoPath: '/p.jpg', priority: 4 },
  ],
  free: [],
  ads: [],
  rent: [
    { id: 9, name: 'Amazon Video', logoPath: '/a.jpg', priority: 1 },
    { id: 2, name: 'Apple TV Store', logoPath: '/apple.jpg', priority: 2 },
    { id: 486, name: 'Spectrum On Demand', logoPath: '/xiUQmGI2bi8Rn6C5u2bArB4YHMp.jpg', priority: 3 },
  ],
  buy: [
    { id: 9, name: 'Amazon Video', logoPath: '/a.jpg', priority: 1 },
    { id: 2, name: 'Apple TV Store', logoPath: '/apple.jpg', priority: 2 },
  ],
};

describe('parseWatchProviders', () => {
  it('keeps every US offer, including free and ads, sorted by priority', () => {
    const parsed = parseWatchProviders({
      link: LINK,
      flatrate: [
        { provider_id: 531, provider_name: 'Paramount Plus', logo_path: '/p.jpg', display_priority: 8 },
        { provider_id: 119, provider_name: 'Amazon Prime Video', logo_path: '/prime.jpg', display_priority: 1 },
        { provider_id: 119, provider_name: 'Amazon Prime Video', logo_path: '/prime.jpg', display_priority: 4 },
        { provider_id: 257, provider_name: 'fuboTV', logo_path: '/f.jpg', display_priority: 3 },
        { provider_id: 582, provider_name: 'Paramount Plus Essential', logo_path: '/p.jpg', display_priority: 9 },
        { provider_id: 300, provider_name: 'Pluto TV', logo_path: '/pluto.jpg', display_priority: 2 },
      ],
      free: [{ provider_id: 191, provider_name: 'Kanopy', logo_path: '/k.jpg', display_priority: 5 }],
      ads: [{ provider_id: 73, provider_name: 'Tubi', logo_path: '/t.jpg', display_priority: 6 }],
      rent: [{ provider_id: 2, provider_name: 'Apple TV Store', logo_path: '/a.jpg', display_priority: 1 }],
      buy: [{ provider_id: 9, provider_name: 'Amazon Video', logo_path: '/az.jpg', display_priority: 1 }],
    });

    expect(parsed?.stream.map((offer) => offer.name)).toEqual([
      'Amazon Prime Video',
      'Pluto TV',
      'fuboTV',
      'Paramount Plus',
      'Paramount Plus Essential',
    ]);
    expect(parsed?.free.map((offer) => offer.name)).toEqual(['Kanopy']);
    expect(parsed?.ads.map((offer) => offer.name)).toEqual(['Tubi']);
    expect(parsed?.rent).toHaveLength(1);
    expect(parsed?.buy).toHaveLength(1);
    expect(parsed?.link).toBe(LINK);
  });

  it('returns null when the country has no offers', () => {
    expect(parseWatchProviders({ link: LINK, flatrate: [] })).toBeNull();
    expect(parseWatchProviders(null)).toBeNull();
  });
});

describe('white marks', () => {
  it('uses the parent service for channel add-ons and leaves unknown stores on the tile', () => {
    expect(whiteMarkKey(1, 'Paramount+ Amazon Channel')).toBe('paramountplus');
    expect(whiteMarkKey(999, 'MGM+ Amazon Channel')).toBeNull();
    expect(whiteMarkKey(486, 'Spectrum On Demand')).toBeNull();
    expect(whiteMarkKey(119, 'Amazon Prime Video')).toBe('primevideo');
    expect(whiteMarkKey(9, 'Amazon Video')).toBe('amazon');
    expect(whiteMarkKey(8, 'Netflix')).toBe('netflix');
  });
});

describe('WhereToWatch', () => {
  it('shows stream, rent, and buy names and links the JustWatch credit', () => {
    const html = renderToString(React.createElement(WhereToWatch, { providers: PULP }));

    expect(html).toContain('Where to watch');
    expect(html).toContain('Stream');
    expect(html).toContain('Rent');
    expect(html).toContain('Buy');
    expect(html).toContain('Amazon Prime Video');
    expect(html).toContain('fuboTV');
    expect(html).toContain('Paramount Plus Premium');
    expect(html).not.toContain('Paramount Plus Essential');
    expect(html).toContain('Amazon Video');
    expect(html).toContain('Apple TV Store');
    expect(html).toContain('Spectrum On Demand');
    expect(html).toContain('See all');
    expect(html).toContain(`href="${LINK}"`);
    expect(html).toContain('JustWatch');
    expect(html).toContain('data-testid="where-to-watch-credit"');
    expect(html).toContain('/providers/primevideo.svg');
    expect(html).toContain('https://image.tmdb.org/t/p/w92/xiUQmGI2bi8Rn6C5u2bArB4YHMp.jpg');
  });

  it('renders nothing when there are no offers', () => {
    const html = renderToString(React.createElement(WhereToWatch, { providers: null }));
    expect(html).toBe('');
  });
});
