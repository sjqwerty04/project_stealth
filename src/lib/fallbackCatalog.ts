/** Offline / missing-TMDB catalog so hunt, onboarding, and detail still render. */
export type FallbackFilm = {
  id: number;
  title: string;
  year: string;
  posterPath: string;
  backdropPath?: string;
  overview: string;
  runtime: string;
  mediaType: 'movie';
};

export const FALLBACK_FILMS: FallbackFilm[] = [
  {
    id: 155,
    title: 'The Dark Knight',
    year: '2008',
    posterPath: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    backdropPath: '/hkBaDkMWbLaf8B1lsWsKX7Ew3Xq.jpg',
    overview: 'A vigilante and a clown take turns ruining Gotham.',
    runtime: '2h 32m',
    mediaType: 'movie',
  },
  {
    id: 27205,
    title: 'Inception',
    year: '2010',
    posterPath: '/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
    backdropPath: '/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
    overview: 'A heist inside a dream inside a briefing.',
    runtime: '2h 28m',
    mediaType: 'movie',
  },
  {
    id: 496243,
    title: 'Parasite',
    year: '2019',
    posterPath: '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
    backdropPath: '/tuPqqob6jUCiBNqJ1zXgYhXTCX2.jpg',
    overview: 'Stairs, smell, and a plan that will not stay downstairs.',
    runtime: '2h 12m',
    mediaType: 'movie',
  },
  {
    id: 389,
    title: '12 Angry Men',
    year: '1957',
    posterPath: '/ow3wq89wM8qd5X7hWKxiRfsFf9C.jpg',
    overview: 'Twelve men, one room, no air conditioning.',
    runtime: '1h 36m',
    mediaType: 'movie',
  },
  {
    id: 550,
    title: 'Fight Club',
    year: '1999',
    posterPath: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
    overview: 'Soap, insomnia, and a very specific kind of club.',
    runtime: '2h 19m',
    mediaType: 'movie',
  },
  {
    id: 13,
    title: 'Forrest Gump',
    year: '1994',
    posterPath: '/saHP97rTPS5eLmrLQEcANmKrsFl.jpg',
    overview: 'A man runs through American history.',
    runtime: '2h 22m',
    mediaType: 'movie',
  },
];

export function fallbackByQuery(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return FALLBACK_FILMS;
  const hits = FALLBACK_FILMS.filter((f) => f.title.toLowerCase().includes(q));
  return hits.length ? hits : FALLBACK_FILMS;
}

export function fallbackById(id: number) {
  return FALLBACK_FILMS.find((f) => f.id === id) ?? FALLBACK_FILMS[0];
}

export function posterUrl(path: string, size: 'w200' | 'w500' = 'w200') {
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
