import { describe, expect, it } from 'vitest';
import { tmdbTheaterSearch, type TmdbDeps } from './tmdb';
import type { TheaterFilm, TheaterPick } from './types';

const SAMOURAI: TheaterPick = {
  title: 'Le Samouraï',
  year: '1967',
  reason: 'A contract killer follows his routine flawlessly and it still closes on him.',
};

const SEARCH_HIT = {
  page: 1,
  results: [
    {
      id: 5511,
      title: 'Le Samouraï',
      release_date: '1967-10-25',
      poster_path: '/samourai.jpg',
      backdrop_path: '/samourai-backdrop.jpg',
      genre_ids: [80, 18, 53],
      overview: 'A hitman takes a contract and a witness sees his face.',
      popularity: 12.5,
      vote_average: 8.1,
      vote_count: 1204,
    },
  ],
};

const DETAILS = {
  id: 5511,
  title: 'Le Samouraï',
  release_date: '1967-10-25',
  poster_path: '/samourai.jpg',
  backdrop_path: '/samourai-backdrop.jpg',
  genres: [
    { id: 80, name: 'Crime' },
    { id: 18, name: 'Drama' },
    { id: 53, name: 'Thriller' },
  ],
  credits: {
    cast: [{ id: 11, name: 'Alain Delon', character: 'Jef Costello' }],
    crew: [
      { id: 21, name: 'Georges Casati', job: 'Editor' },
      { id: 22, name: 'Jean-Pierre Melville', job: 'Director' },
    ],
  },
};

const SAMOURAI_FILM: TheaterFilm = {
  id: 5511,
  title: 'Le Samouraï',
  year: '1967',
  posterPath: '/samourai.jpg',
  backdropPath: '/samourai-backdrop.jpg',
  genres: ['Crime', 'Drama', 'Thriller'],
  director: 'Jean-Pierre Melville',
  mediaType: 'movie',
};

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

function recorder(route: (url: string) => Response | Promise<Response>) {
  const urls: string[] = [];
  const deps: TmdbDeps = {
    apiKey: 'test-key',
    fetch: async (url) => {
      urls.push(url);
      return route(url);
    },
  };
  return { urls, search: tmdbTheaterSearch(deps) };
}

const catalogue = (url: string): Response => {
  if (url.includes('/search/movie')) return json(SEARCH_HIT);
  if (url.includes('/movie/5511')) return json(DETAILS);
  return new Response('not found', { status: 404 });
};

describe('tmdbTheaterSearch', () => {
  it('searches title plus year, then reads details with credits', async () => {
    const tmdb = recorder(catalogue);
    expect(await tmdb.search(SAMOURAI)).toEqual(SAMOURAI_FILM);
    expect(tmdb.urls).toEqual([
      'https://api.themoviedb.org/3/search/movie?api_key=test-key&language=en-US&query=Le+Samoura%C3%AF&year=1967',
      'https://api.themoviedb.org/3/movie/5511?api_key=test-key&language=en-US&append_to_response=credits',
    ]);
  });

  it('falls back to the title alone when the year search is empty', async () => {
    let searches = 0;
    const tmdb = recorder((url) => {
      if (!url.includes('/search/movie')) return catalogue(url);
      searches += 1;
      return searches === 1 ? json({ results: [] }) : json(SEARCH_HIT);
    });

    expect(await tmdb.search({ ...SAMOURAI, year: '1968' })).toEqual(SAMOURAI_FILM);
    expect(tmdb.urls).toEqual([
      'https://api.themoviedb.org/3/search/movie?api_key=test-key&language=en-US&query=Le+Samoura%C3%AF&year=1968',
      'https://api.themoviedb.org/3/search/movie?api_key=test-key&language=en-US&query=Le+Samoura%C3%AF',
      'https://api.themoviedb.org/3/movie/5511?api_key=test-key&language=en-US&append_to_response=credits',
    ]);
  });

  it('spends no details request on a title that does not match the pick', async () => {
    const tmdb = recorder(catalogue);
    const film = await tmdb.search({ ...SAMOURAI, title: 'The Godfather' });
    expect(film).toEqual({ ...SAMOURAI_FILM, genres: [], director: null });
    expect(tmdb.urls).toHaveLength(1);
  });

  it('keeps the search candidate when details or credits fail', async () => {
    const tmdb = recorder((url) =>
      url.includes('/search/movie') ? json(SEARCH_HIT) : new Response('boom', { status: 500 }),
    );
    expect(await tmdb.search(SAMOURAI)).toEqual({ ...SAMOURAI_FILM, genres: [], director: null });
  });

  it('reports no director when the crew carries none', async () => {
    const tmdb = recorder((url) =>
      url.includes('/search/movie')
        ? json(SEARCH_HIT)
        : json({ ...DETAILS, credits: { crew: [{ id: 21, name: 'Georges Casati', job: 'Editor' }] } }),
    );
    expect(await tmdb.search(SAMOURAI)).toEqual({ ...SAMOURAI_FILM, director: null });
  });

  it('yields null on an empty result, a failed search, and malformed payloads', async () => {
    for (const body of [{ results: [] }, {}, { results: 'nope' }, { results: [{ title: 'Le Samouraï' }] }, null]) {
      const tmdb = recorder(() => json(body));
      expect(await tmdb.search(SAMOURAI)).toBeNull();
    }
    const failing = recorder(() => new Response('rate limited', { status: 429 }));
    expect(await failing.search(SAMOURAI)).toBeNull();
  });

  it('takes the year from details and reports none when neither payload carries one', async () => {
    const wrongYear = recorder((url) =>
      url.includes('/search/movie') ? json({ results: [{ ...SEARCH_HIT.results[0], release_date: 1967 }] }) : catalogue(url),
    );
    expect(await wrongYear.search(SAMOURAI)).toEqual(SAMOURAI_FILM);

    const noYear = recorder((url) =>
      url.includes('/search/movie')
        ? json({ results: [{ ...SEARCH_HIT.results[0], release_date: undefined }] })
        : json({ ...DETAILS, release_date: undefined }),
    );
    expect(await noYear.search(SAMOURAI)).toEqual({ ...SAMOURAI_FILM, year: '' });

    const noImages = recorder((url) =>
      url.includes('/search/movie')
        ? json({ results: [{ ...SEARCH_HIT.results[0], poster_path: null, backdrop_path: undefined }] })
        : json({ ...DETAILS, poster_path: null, backdrop_path: undefined }),
    );
    expect(await noImages.search(SAMOURAI)).toEqual({ ...SAMOURAI_FILM, posterPath: null, backdropPath: null });
  });
});
