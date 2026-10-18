import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrbitMovie } from '../stores/orbitStore';

vi.mock('./llm', () => ({
  callLlmForJSON: vi.fn(),
}));

import { callLlmForJSON } from './llm';
import { getNextMovie } from './orbitEngine';

const llm = vi.mocked(callLlmForJSON);

const source: OrbitMovie = {
  id: 155,
  title: 'The Dark Knight',
  year: '2008',
  posterPath: null,
  backdropPath: null,
  dominantHex: '#111111',
  mediaType: 'movie',
  genres: ['Drama'],
  director: 'Christopher Nolan',
};

function tmdbResponse(url: string) {
  const parsed = new URL(url);
  if (parsed.pathname.includes('/search/movie')) {
    const title = parsed.searchParams.get('query') || '';
    const id = title === 'Heat' ? 949 : 11524;
    const name = title === 'Heat' ? 'Heat' : 'Thief';
    return { id, title: name };
  }
  const id = Number(parsed.pathname.match(/movie\/(\d+)/)?.[1]);
  const title = id === 949 ? 'Heat' : 'Thief';
  return { id, title };
}

beforeEach(() => {
  llm.mockReset();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const film = tmdbResponse(String(url));
    if (String(url).includes('/search/movie')) {
      return { ok: true, json: async () => ({ results: [{ id: film.id, title: film.title }] }) };
    }
    return {
      ok: true,
      json: async () => ({
        id: film.id,
        title: film.title,
        release_date: '1995-01-01',
        poster_path: null,
        backdrop_path: null,
        genres: [],
        credits: { crew: [] },
      }),
    };
  }));
});

describe('orbit watched exclusion', () => {
  it('leaves a signed-out recommendation unchanged', async () => {
    llm.mockResolvedValueOnce({ title: 'Heat', year: '1995', hex: '#111111', score: 90, reason: 'Night crime from The Dark Knight' });
    const result = await getNextMovie(source, 'right', null, []);
    expect(result?.movie.id).toBe(949);
    expect(llm).toHaveBeenCalledTimes(1);
    expect(String(llm.mock.calls[0][0])).not.toContain('already watched');
  });

  it('asks again when the first pick is already watched', async () => {
    llm
      .mockResolvedValueOnce({ title: 'Heat', year: '1995', hex: '#111111', score: 90, reason: 'Night crime from The Dark Knight' })
      .mockResolvedValueOnce({ title: 'Thief', year: '1981', hex: '#222222', score: 84, reason: 'Night crime from The Dark Knight' });
    const result = await getNextMovie(source, 'right', null, [{ id: '949', title: 'Heat' }]);
    expect(result?.movie).toMatchObject({ id: 11524, title: 'Thief' });
    expect(llm).toHaveBeenCalledTimes(2);
    expect(String(llm.mock.calls[1][0])).toContain('Heat');
  });

  it('drops the direction when the retry is still a watched film', async () => {
    llm.mockResolvedValue({ title: 'Heat', year: '1995', hex: '#111111', score: 90, reason: 'Night crime from The Dark Knight' });
    const result = await getNextMovie(source, 'right', null, [{ id: '949', title: 'Heat' }]);
    expect(result).toBeNull();
    expect(llm).toHaveBeenCalledTimes(2);
  });
});
