import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
 Search,
 Users,
 Plus,
 Check,
 Trash2,
 Edit2,
 Sparkles,
 Loader2,
 Repeat,
 ThumbsUp,
 ThumbsDown,
 SkipForward,
 CalendarPlus,
 RefreshCw,
 User as UserIcon,
 Info,
 ChevronLeft,
 ChevronRight,
} from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCalendarLogs, type CalendarEvent } from '../hooks/useCalendarLogs';
import { useUserProfile } from '../hooks/useUserProfile';
import { useAuth } from '../hooks/useAuth';
import { logMovieAdded } from '../lib/analytics';
import { useRecommendation } from '../hooks/useRecommendation';
import ProfileDropdown from '../components/ProfileDropdown';
import { callClaude } from '../lib/claude';

type RatingValue = 'up' | 'down' | null;

type Movie = {
 id: number;
 title: string;
 year: number | string;
 runtime: string;
 poster: string;
 backdrop?: string;
 mediaType?: 'movie' | 'tv';
 popularity?: number;
 accentStart?: string;
 accentEnd?: string;
 accentText?: string;
};

// ─── TMDB Setup ───────────────────────────────────────────────
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_POSTER_PLACEHOLDER = 'https://placehold.co/200x300?text=Movie';
const TMDB_BACKDROP_PLACEHOLDER = 'https://placehold.co/600x400?text=Backdrop';

const TRENDING_CACHE_KEY = 'movielove_trending_cache_v1';
const TRENDING_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type AccentColors = { start: string; end: string; text: string };
type TrendingCachePayload = { timestamp: number; items: Movie[] };

const buildImageUrl = (path: string | null | undefined, size: 'w200' | 'w500' | 'w780' = 'w200') => {
 if (!path) return size === 'w200' ? TMDB_POSTER_PLACEHOLDER : TMDB_BACKDROP_PLACEHOLDER;
 return `https://image.tmdb.org/t/p/${size}${path}`;
};

// ─── Color Utilities ──────────────────────────────────────────
const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
 r /= 255; g /= 255; b /= 255;
 const max = Math.max(r, g, b), min = Math.min(r, g, b);
 let h = 0, s = 0;
 const l = (max + min) / 2;
 if (max !== min) {
  const d = max - min;
  s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  switch (max) {
   case r: h = (g - b) / d + (g < b ? 6 : 0); break;
   case g: h = (b - r) / d + 2; break;
   default: h = (r - g) / d + 4; break;
  }
  h /= 6;
 }
 return [h * 360, s, l];
};

const hslToHex = (h: number, s: number, l: number): string => {
 const _h = ((h % 360) + 360) % 360;
 const _s = Math.min(1, Math.max(0, s / 100));
 const _l = Math.min(1, Math.max(0, l / 100));
 const hue2rgb = (p: number, q: number, t: number) => {
  if (t < 0) t += 1; if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
 };
 let r: number, g: number, b: number;
 if (_s === 0) { r = g = b = _l; } else {
  const q = _l < 0.5 ? _l * (1 + _s) : _l + _s - _l * _s;
  const p = 2 * _l - q;
  r = hue2rgb(p, q, _h / 360 + 1 / 3);
  g = hue2rgb(p, q, _h / 360);
  b = hue2rgb(p, q, _h / 360 - 1 / 3);
 }
 const toHex = (v: number) => { const hex = Math.round(v * 255).toString(16); return hex.length === 1 ? `0${hex}` : hex; };
 return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const getTextColorFromRGB = (r: number, g: number, b: number) => {
 const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
 return luminance > 0.6 ? '#050505' : '#f8fafc';
};

const shiftLightness = (h: number, s: number, l: number, delta: number) =>
 hslToHex(h, s * 100, Math.min(100, Math.max(0, l * 100 + delta)));

const DEFAULT_ACCENT: AccentColors = { start: '#201c3a', end: '#0d1531', text: '#f8fafc' };

const generateFallbackAccent = (seed: string): AccentColors => {
 let hash = 0;
 for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
 const h = Math.abs(hash % 360);
 return { start: hslToHex(h, 85, 65), end: hslToHex((h + 40) % 360, 90, 35), text: '#f8fafc' };
};

const fetchLLMColors = async (movieTitle: string, year?: string | number): Promise<AccentColors | null> => {
 const movieLabel = year ? `${movieTitle} (${year})` : movieTitle;
 const systemPrompt = `You are a color analysis expert specializing in movie poster design and color grading. You have perfect recall of theatrical release posters and their iconic color palettes.`;
 const prompt = `<task>
Identify the two most dominant, iconic colors from the official theatrical release poster for this film.
</task>
<film>"${movieLabel}"</film>
<rules>
- Focus strictly on the official theatrical release poster art, not general movie scenes
- Capture the specific hue and saturation used in the marketing materials
- If the poster uses a distinct neon gradient or monochromatic filter, extract those exact shades
- Ensure the text color provides high contrast and readability
</rules>
<output_format>
Return ONLY a valid JSON object (no markdown, no code blocks):
{"start": "#HEX1", "end": "#HEX2", "text": "#HEX3"}
- "start": Primary dominant color from the poster (main background wash)
- "end": Secondary accent color that creates gradient or contrast
- "text": Legible text color (#f8fafc for dark backgrounds or #050505 for light backgrounds)
</output_format>
<example>{"start": "#1a1a2e", "end": "#ff6b35", "text": "#f8fafc"}</example>`;

 try {
  const text = await callClaude(prompt, systemPrompt);
  if (!text) return null;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
   const parsed = JSON.parse(jsonMatch[0]);
   if (parsed.start && parsed.end) return { start: parsed.start, end: parsed.end, text: parsed.text || '#f8fafc' };
  }
  return null;
 } catch { return null; }
};

const extractAccentFromImage = async (imageUrl?: string | null): Promise<AccentColors> => {
 if (!imageUrl || typeof window === 'undefined') return DEFAULT_ACCENT;
 const fallback = generateFallbackAccent(imageUrl);
 const samplePixel = (data: Uint8ClampedArray, width: number, x: number, y: number) => {
  const idx = (y * width + x) * 4;
  if (data[idx + 3] < 180) return null;
  return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
 };

 return new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.src = imageUrl;
  img.onload = () => {
   try {
    const canvas = document.createElement('canvas');
    const size = 64;
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No context');
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const samples: Array<{ r: number; g: number; b: number; h: number; s: number; l: number; score: number }> = [];
    const step = 4;
    for (let y = 0; y < size; y += step) {
     for (let x = 0; x < size; x += step) {
      const pixel = samplePixel(data, size, x, y);
      if (!pixel) continue;
      const [h, s, l] = rgbToHsl(pixel.r, pixel.g, pixel.b);
      const brightness = Math.max(pixel.r, pixel.g, pixel.b) / 255;
      const density = s;
      samples.push({ ...pixel, h, s, l, score: brightness * 0.7 + density * 0.3 });
     }
    }
    if (!samples.length) { resolve(fallback); return; }
    samples.sort((a, b) => b.score - a.score);
    const primary = samples[0];
    let secondary = samples.find((s) => Math.abs(s.h - primary.h) > 60);
    if (!secondary) secondary = { ...primary, l: Math.max(0, primary.l - 0.25) };
    const start = shiftLightness(primary.h, primary.s, primary.l, 10);
    const end = secondary === primary ? shiftLightness(primary.h, primary.s, primary.l, -35) : shiftLightness(secondary.h, secondary.s, secondary.l, -15);
    resolve({ start, end, text: getTextColorFromRGB(primary.r, primary.g, primary.b) });
   } catch { resolve(fallback); }
  };
  img.onerror = () => resolve(fallback);
 });
};

// ─── TMDB Helpers ─────────────────────────────────────────────
const normalizeTmdbResult = (item: any): Movie => {
 const mediaType: 'movie' | 'tv' = item.media_type === 'tv' || item.first_air_date ? 'tv' : 'movie';
 return {
  id: item.id,
  title: item.title || item.name || 'Untitled',
  year: (item.release_date || item.first_air_date || '').slice(0, 4) || '----',
  runtime: mediaType === 'tv' ? 'Series' : 'Feature',
  poster: buildImageUrl(item.poster_path),
  backdrop: buildImageUrl(item.backdrop_path, 'w780'),
  mediaType,
  popularity: item.popularity ?? 0,
 };
};

const formatRuntime = (minutes?: number | null): string => {
 if (!minutes || minutes <= 0) return 'Feature';
 const hrs = Math.floor(minutes / 60);
 const mins = minutes % 60;
 return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
};

const normalizeDetailResult = (data: any, mediaType: 'movie' | 'tv'): Movie => ({
 id: data?.id,
 title: data?.title || data?.name || 'Untitled',
 year: (data?.release_date || data?.first_air_date || '').slice(0, 4) || '----',
 runtime: mediaType === 'movie' ? formatRuntime(data?.runtime) : 'Series',
 poster: buildImageUrl(data?.poster_path),
 backdrop: buildImageUrl(data?.backdrop_path, 'w780'),
 mediaType,
 popularity: data?.popularity ?? 0,
});

const readTrendingCache = (): TrendingCachePayload | null => {
 try {
  const raw = window.localStorage.getItem(TRENDING_CACHE_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!parsed?.timestamp || !parsed?.items) return null;
  if (Date.now() - parsed.timestamp > TRENDING_CACHE_TTL_MS) return null;
  return parsed;
 } catch { return null; }
};

const writeTrendingCache = (movies: Movie[]) => {
 try { window.localStorage.setItem(TRENDING_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), items: movies })); } catch {}
};

const MOCK_DB: Movie[] = [
 { id: 1, title: 'Interstellar', year: 2014, runtime: '2h 49m', poster: 'https://image.tmdb.org/t/p/w200/gEU2QniL6C8zEfVIuM8nEyh09ny.jpg', backdrop: 'https://image.tmdb.org/t/p/w500/rAiYTfKGqDCRIIqo664sY9XZIvQ.jpg' },
 { id: 2, title: 'The Grand Budapest Hotel', year: 2014, runtime: '1h 39m', poster: 'https://image.tmdb.org/t/p/w200/eWdyYQreja6JGCzqHWXpWHDrrPo.jpg', backdrop: 'https://image.tmdb.org/t/p/w500/nX5XotM9yprCKarRH4BNhmNLh0H.jpg' },
 { id: 3, title: 'Dune: Part Two', year: 2024, runtime: '2h 46m', poster: 'https://image.tmdb.org/t/p/w200/1pdfLvkbY9ohJlCjQH2GBAsJbge.jpg', backdrop: 'https://image.tmdb.org/t/p/w500/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg' },
];

// ─── Popcorn SVG Component ────────────────────────────────────
function PopcornIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
 return (
  <svg className={className} style={style} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
   <path d="M18 28L14 56C14 57.1 14.9 58 16 58H48C49.1 58 50 57.1 50 56L46 28H18Z" fill="#E53935" stroke="#B71C1C" strokeWidth="1.5"/>
   <path d="M20 28L16.5 54H47.5L44 28H20Z" fill="#EF5350"/>
   <rect x="22" y="28" width="2" height="26" rx="1" fill="#FFCDD2" opacity="0.3"/>
   <rect x="30" y="28" width="2" height="26" rx="1" fill="#FFCDD2" opacity="0.3"/>
   <rect x="38" y="28" width="2" height="26" rx="1" fill="#FFCDD2" opacity="0.3"/>
   <circle cx="24" cy="20" r="8" fill="#FFF9C4" stroke="#F9A825" strokeWidth="1"/>
   <circle cx="32" cy="16" r="9" fill="#FFF9C4" stroke="#F9A825" strokeWidth="1"/>
   <circle cx="40" cy="20" r="8" fill="#FFF9C4" stroke="#F9A825" strokeWidth="1"/>
   <circle cx="28" cy="14" r="7" fill="#FFFDE7" stroke="#F9A825" strokeWidth="1"/>
   <circle cx="36" cy="13" r="7" fill="#FFFDE7" stroke="#F9A825" strokeWidth="1"/>
   <circle cx="22" cy="22" r="5" fill="#FFF8E1"/>
   <circle cx="42" cy="22" r="5" fill="#FFF8E1"/>
   <circle cx="32" cy="10" r="5" fill="#FFF8E1"/>
  </svg>
 );
}

// ─── Main Component ───────────────────────────────────────────
export default function HomeV2() {
 const navigate = useNavigate();
 const { user } = useAuth();
 const { loading: eventsLoading, addEvent, updateEvent, deleteEvent, getEventsForDate } = useCalendarLogs();
 const { profileImage } = useUserProfile();
 const {
  recommendation,
  isLoading: recLoading,
  error: recError,
  generateRecommendation,
  rateRecommendation,
  refreshRecommendation,
  skipRecommendation,
 } = useRecommendation();

 // Hero accent state
 const [heroAccent, setHeroAccent] = useState<AccentColors>(DEFAULT_ACCENT);

 // Date strip state
 const [selectedDate, setSelectedDate] = useState<Date>(new Date());
 const dateStripRef = useRef<HTMLDivElement>(null);

 // Modal state
 const [isModalOpen, setIsModalOpen] = useState(false);
 const [viewMode, setViewMode] = useState<'search' | 'confirm' | 'details' | 'events' | 'success'>('search');
 const [searchQuery, setSearchQuery] = useState('');
 const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
 const [inviteFriend, setInviteFriend] = useState(false);
 const [editingEventId, setEditingEventId] = useState<string | null>(null);
 const [dayEvents, setDayEvents] = useState<CalendarEvent[]>([]);
 const [rating, setRating] = useState<RatingValue>(null);
 const [lastSavedMovie, setLastSavedMovie] = useState<Movie | null>(null);
 const [lastSavedRating, setLastSavedRating] = useState<RatingValue>(null);
 const [selectedAccent, setSelectedAccent] = useState<AccentColors>(DEFAULT_ACCENT);
 const [isSaving, setIsSaving] = useState(false);

 // Search state
 const [searchResults, setSearchResults] = useState<Movie[]>([]);
 const [isSearchingMovies, setIsSearchingMovies] = useState(false);
 const [searchError, setSearchError] = useState('');
 const [featuredMovies, setFeaturedMovies] = useState<Movie[]>([]);
 const [isLoadingFeatured, setIsLoadingFeatured] = useState(false);

 // Movie assets
 const [movieLogoUrl, setMovieLogoUrl] = useState<string | null>(null);
 const [movieHeroUrl, setMovieHeroUrl] = useState<string | null>(null);
 const [isLoadingLogo, setIsLoadingLogo] = useState(false);

 // Recommendation action state
 const [isRating, setIsRating] = useState(false);
 const [isSkipping, setIsSkipping] = useState(false);
 const [showSuccess, setShowSuccess] = useState<'up' | 'down' | null>(null);

 // ─── Generate date range for strip ───
 const generateDateRange = useCallback(() => {
  const dates: Date[] = [];
  const center = new Date(selectedDate);
  for (let i = -14; i <= 14; i++) {
   const d = new Date(center);
   d.setDate(center.getDate() + i);
   dates.push(d);
  }
  return dates;
 }, [selectedDate]);

 const dateRange = generateDateRange();

 // ─── Auto-generate recommendation on mount ───
 useEffect(() => {
  if (!recommendation && !recLoading && !recError) {
   generateRecommendation();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 // ─── Extract hero accent from recommendation poster ───
 useEffect(() => {
  if (!recommendation?.poster) { setHeroAccent(DEFAULT_ACCENT); return; }
  let cancelled = false;
  const getColors = async () => {
   const llm = await fetchLLMColors(recommendation.title, recommendation.year);
   if (llm && !cancelled) { setHeroAccent(llm); return; }
   const img = await extractAccentFromImage(recommendation.poster);
   if (!cancelled) setHeroAccent(img);
  };
  getColors();
  return () => { cancelled = true; };
 }, [recommendation?.movieId, recommendation?.poster, recommendation?.title, recommendation?.year]);

 // ─── Scroll date strip to center on mount ───
 useEffect(() => {
  if (dateStripRef.current) {
   const container = dateStripRef.current;
   const centerChild = container.children[14] as HTMLElement;
   if (centerChild) {
    const scrollLeft = centerChild.offsetLeft - container.clientWidth / 2 + centerChild.offsetWidth / 2;
    container.scrollTo({ left: scrollLeft, behavior: 'auto' });
   }
  }
 }, [selectedDate]);

 // ─── Fetch featured/trending movies ───
 useEffect(() => {
  let cancelled = false;
  const fetchFeatured = async () => {
   if (!TMDB_API_KEY) { setFeaturedMovies(MOCK_DB); return; }
   try {
    setIsLoadingFeatured(true);
    const res = await fetch(`${TMDB_BASE}/trending/all/week?api_key=${TMDB_API_KEY}&language=en-US`);
    if (!res.ok) throw new Error('TMDB trending fetch failed');
    const data = await res.json();
    const items = (data?.results ?? []).filter((i: any) => i && (i.media_type === 'movie' || i.media_type === 'tv')).slice(0, 12);
    const results = await Promise.all(items.map(async (item: any) => {
     const mt: 'movie' | 'tv' = item.media_type === 'tv' ? 'tv' : 'movie';
     try {
      const r = await fetch(`${TMDB_BASE}/${mt}/${item.id}?api_key=${TMDB_API_KEY}&language=en-US`);
      if (!r.ok) throw new Error();
      return normalizeDetailResult(await r.json(), mt);
     } catch { return normalizeTmdbResult(item); }
    }));
    if (!cancelled) {
     const filtered = results.filter(Boolean).slice(0, 10);
     const finalList = filtered.length > 0 ? filtered : MOCK_DB;
     setFeaturedMovies(finalList);
     if (filtered.length > 0) writeTrendingCache(finalList);
    }
   } catch { if (!cancelled) setFeaturedMovies(MOCK_DB); }
   finally { if (!cancelled) setIsLoadingFeatured(false); }
  };
  const cached = readTrendingCache();
  if (cached && cached.items.length > 0) { setFeaturedMovies(cached.items); return () => { cancelled = true; }; }
  fetchFeatured();
  return () => { cancelled = true; };
 }, []);

 // ─── Search effect ───
 useEffect(() => {
  let cancelled = false;
  const controller = new AbortController();
  const trimmed = searchQuery.trim();
  if (!trimmed) { setSearchResults([]); setSearchError(''); setIsSearchingMovies(false); return () => { cancelled = true; controller.abort(); }; }
  const timeout = setTimeout(async () => {
   try {
    setIsSearchingMovies(true); setSearchError('');
    const url = new URL(`${TMDB_BASE}/search/multi`);
    url.searchParams.set('api_key', TMDB_API_KEY);
    url.searchParams.set('language', 'en-US');
    url.searchParams.set('page', '1');
    url.searchParams.set('query', trimmed);
    url.searchParams.set('include_adult', 'false');
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (cancelled) return;
    const normalized = (data.results ?? [])
     .filter((i: any) => i && (i.media_type === 'movie' || i.media_type === 'tv'))
     .map((i: any) => normalizeTmdbResult(i))
     .filter((m: Movie, idx: number, arr: Movie[]) => m.title && arr.findIndex((a) => a.id === m.id) === idx)
     .slice(0, 20);
    const ql = trimmed.toLowerCase();
    const ranked = normalized.map((movie: Movie) => {
     const tl = movie.title.toLowerCase();
     const cl = tl.replace(/^(the|a|an)\s+/i, '');
     const isExact = tl === ql || cl === ql || tl.startsWith(ql) || cl.startsWith(ql);
     const contains = tl.includes(ql) || cl.includes(ql);
     return { movie, matchRank: isExact ? 0 : contains ? 1 : 2, popularity: movie.popularity ?? 0 };
    }).sort((a: any, b: any) => a.matchRank !== b.matchRank ? a.matchRank - b.matchRank : b.popularity - a.popularity).map((e: any) => e.movie);
    setSearchResults(ranked);
    if (ranked.length === 0) setSearchError('No matches on TMDB. Try another title.');
   } catch (e) {
    if (cancelled) return;
    if (e instanceof DOMException && e.name === 'AbortError') return;
    setSearchError('Unable to reach TMDB right now.');
    setSearchResults([]);
   } finally { if (!cancelled) setIsSearchingMovies(false); }
  }, 300);
  return () => { cancelled = true; controller.abort(); clearTimeout(timeout); };
 }, [searchQuery]);

 // ─── Accent extraction for selected movie ───
 useEffect(() => {
  let cancelled = false;
  if (!selectedMovie) { setSelectedAccent(DEFAULT_ACCENT); return; }
  if (selectedMovie.accentStart && selectedMovie.accentEnd && selectedMovie.accentText) {
   setSelectedAccent({ start: selectedMovie.accentStart, end: selectedMovie.accentEnd, text: selectedMovie.accentText });
   return;
  }
  if (!selectedMovie.backdrop) { setSelectedAccent(DEFAULT_ACCENT); return; }
  const getColors = async () => {
   if (selectedMovie.title) { const llm = await fetchLLMColors(selectedMovie.title, selectedMovie.year); if (llm) return llm; }
   return extractAccentFromImage(selectedMovie.backdrop);
  };
  getColors().then((colors) => {
   if (cancelled) return;
   setSelectedAccent(colors);
   setSelectedMovie((prev) => {
    if (!prev || prev.id !== selectedMovie.id) return prev;
    if (prev.accentStart && prev.accentEnd && prev.accentText) return prev;
    return { ...prev, accentStart: colors.start, accentEnd: colors.end, accentText: colors.text };
   });
  });
  return () => { cancelled = true; };
 }, [selectedMovie?.id, selectedMovie?.backdrop, selectedMovie?.accentStart, selectedMovie?.accentEnd, selectedMovie?.accentText]);

 // ─── TMDB movie assets (logo + hero image) ───
 useEffect(() => {
  setMovieLogoUrl(null); setMovieHeroUrl(null);
  if (!selectedMovie?.id) return;
  if (!TMDB_API_KEY) { setMovieHeroUrl(selectedMovie.backdrop ?? null); return; }
  const controller = new AbortController();
  const loadAssets = async () => {
   try {
    setIsLoadingLogo(true);
    const mt = selectedMovie.mediaType === 'tv' ? 'tv' : 'movie';
    const url = new URL(`${TMDB_BASE}/${mt}/${selectedMovie.id}/images`);
    url.searchParams.set('api_key', TMDB_API_KEY);
    url.searchParams.set('include_image_language', 'en,null');
    url.searchParams.set('language', 'en-US');
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const logos = data?.logos ?? [];
    if (logos.length > 0) {
     const preferred = logos.find((l: any) => l.iso_639_1 === 'en') || logos[0];
     setMovieLogoUrl(preferred?.file_path ? buildImageUrl(preferred.file_path, 'w500') : null);
    } else setMovieLogoUrl(null);
    const stillPath = data?.stills?.[0]?.file_path || null;
    if (stillPath) setMovieHeroUrl(buildImageUrl(stillPath, 'w780'));
    else if (data?.backdrops?.[0]?.file_path) setMovieHeroUrl(buildImageUrl(data.backdrops[0].file_path, 'w780'));
    else setMovieHeroUrl(selectedMovie.backdrop ?? null);
   } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    setMovieLogoUrl(null); setMovieHeroUrl(selectedMovie.backdrop ?? null);
   } finally { setIsLoadingLogo(false); }
  };
  loadAssets();
  return () => controller.abort();
 }, [selectedMovie]);

 // ─── Handlers ───
 const isPastDate = (date: Date | null) => {
  if (!date) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(date); target.setHours(0, 0, 0, 0);
  return target <= today;
 };

 const resetModalState = () => {
  setSelectedMovie(null); setSearchQuery(''); setInviteFriend(false);
  setEditingEventId(null); setRating(null); setMovieLogoUrl(null);
  setMovieHeroUrl(null); setSelectedAccent(DEFAULT_ACCENT);
 };

 const handleDayClick = (date: Date, existingEvents?: CalendarEvent[]) => {
  setSelectedDate(date);
  if (existingEvents && existingEvents.length > 0) {
   resetModalState();
   setDayEvents(existingEvents);
   setViewMode('events');
   setIsModalOpen(true);
  } else {
   resetModalState();
   setViewMode('search');
   setIsModalOpen(true);
  }
 };

 const handleSaveEvent = async () => {
  if (!selectedMovie || !selectedDate) return;
  const isPast = isPastDate(selectedDate);
  if (isPast && !rating) return;
  setIsSaving(true);
  const eventData = {
   movieId: selectedMovie.id, title: selectedMovie.title, poster: selectedMovie.poster,
   date: selectedDate.toISOString(), inviteFriend, rating: isPast ? rating : null,
   status: isPast ? 'watched' as const : 'planned' as const,
   backdrop: selectedMovie.backdrop, mediaType: selectedMovie.mediaType,
   year: selectedMovie.year, runtimeLabel: selectedMovie.runtime,
   accentStart: selectedAccent.start, accentEnd: selectedAccent.end, accentText: selectedAccent.text,
  };
  try {
   if (editingEventId) { await updateEvent(editingEventId, eventData); setIsModalOpen(false); }
   else {
    await addEvent(eventData);
    if (isPast && rating && user) {
     const watchedRef = collection(db, 'users', user.uid, 'watched_recommendations');
     await addDoc(watchedRef, {
      movieId: selectedMovie.id, title: selectedMovie.title, year: selectedMovie.year,
      poster: selectedMovie.poster, backdrop: selectedMovie.backdrop, runtime: selectedMovie.runtime,
      mediaType: selectedMovie.mediaType, rating, ratedAt: serverTimestamp(), source: 'calendar',
     });
    }
    await logMovieAdded(selectedMovie.mediaType || 'movie', selectedDate.toISOString());
    if (isPast) { setLastSavedMovie(selectedMovie); setLastSavedRating(rating); setViewMode('success'); }
    else setIsModalOpen(false);
   }
  } catch (error) { console.error('Failed to save event:', error); }
  finally { setIsSaving(false); }
 };

 const handleDeleteEvent = async () => {
  if (!editingEventId) return;
  try { await deleteEvent(editingEventId); setIsModalOpen(false); } catch (error) { console.error('Failed to delete event:', error); }
 };

 const handleRate = async (ratingVal: 'up' | 'down') => {
  if (!recommendation || isRating) return;
  setIsRating(true); setShowSuccess(ratingVal);
  await rateRecommendation(recommendation, ratingVal);
  setTimeout(() => { setShowSuccess(null); setIsRating(false); refreshRecommendation(); }, 600);
 };

 const handleSkip = async () => {
  if (!recommendation || isSkipping) return;
  setIsSkipping(true);
  await skipRecommendation(recommendation);
  setTimeout(() => { setIsSkipping(false); refreshRecommendation(); }, 200);
 };

 const handleAddRecToCalendar = () => {
  if (!recommendation) return;
  const hydratedMovie: Movie = {
   id: recommendation.movieId, title: recommendation.title, year: recommendation.year,
   runtime: recommendation.runtime || 'Feature', poster: recommendation.poster,
   backdrop: recommendation.backdrop, mediaType: recommendation.mediaType,
  };
  setSelectedMovie(hydratedMovie);
  setSelectedDate(new Date());
  setViewMode('confirm');
  setIsModalOpen(true);
 };

 // ─── Derived ───
 const isPast = isPastDate(selectedDate);
 const hasQuery = searchQuery.trim().length > 0;
 const fallbackMovies = featuredMovies.length > 0 ? featuredMovies : MOCK_DB;
 const filteredMovies = hasQuery ? searchResults : fallbackMovies;
 const noMatches = hasQuery && !isSearchingMovies && searchResults.length === 0;

 if (eventsLoading) {
  return (
   <div className="h-screen w-full flex items-center justify-center bg-black text-fg-3">
    <Loader2 className="w-8 h-8 animate-spin" />
   </div>
  );
 }

 return (
  <div className="h-[100dvh] bg-base font-display text-fg flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden border-x border-line relative">

   {/* ─── Header ─── */}
   <div className="bg-base/90 backdrop-blur-md px-5 py-4 flex items-center justify-between z-10 border-b border-line flex-shrink-0">
    <div>
     <h1 className="text-xl font-bold tracking-tight text-fg">Selects</h1>
     <p className="text-[10px] text-fg-3 uppercase tracking-wider font-semibold">Your Cinema Journal</p>
    </div>
    <div className="flex items-center gap-2">
     <button onClick={() => navigate('/discover')} className="p-2 hover:bg-gray-800 transition-colors text-fg-2 hover:text-fg">
      <Search size={18} />
     </button>
     <ProfileDropdown profileImage={profileImage} onOpenAvatarModal={() => {}} />
    </div>
   </div>

   {/* ─── Hero Section (Recommendation) ─── */}
   <div className="flex-1 relative overflow-hidden flex flex-col" style={{
    backgroundImage: `radial-gradient(ellipse at top center, ${heroAccent.start}40, ${heroAccent.end}20, #09090b 80%)`,
   }}>

    {recLoading && !recommendation ? (
     <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
      <div className="p-3 bg-blue-500/10">
       <Sparkles className="w-6 h-6 text-blue-400 animate-pulse" />
      </div>
      <div className="text-center">
       <p className="text-sm font-medium text-fg mb-1">Finding your next watch...</p>
       <Loader2 className="w-5 h-5 text-blue-400 animate-spin mx-auto" />
      </div>
     </div>
    ) : recError && !recommendation ? (
     <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
      <Sparkles className="w-6 h-6 text-blue-400" />
      <p className="text-sm text-red-400 text-center">{recError}</p>
      <button onClick={() => generateRecommendation()} className="text-xs px-4 py-2 bg-blue-600 hover:bg-blue-500 text-fg rounded-lg transition-colors">
       Try Again
      </button>
     </div>
    ) : recommendation ? (
     <>
      {/* Next Watch Label with Popcorn */}
      <div className="flex items-center justify-center gap-3 pt-4 pb-2 px-6">
       <PopcornIcon className="w-8 h-8" style={{ transform: 'rotate(-12deg)' }} />
       <div className="text-center">
        <div className="flex items-center gap-1.5 justify-center">
         <Sparkles className="w-3.5 h-3.5 text-blue-400" />
         <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Next Watch</span>
        </div>
        <p className="text-[10px] text-fg-3 mt-0.5">
         {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
       </div>
       <PopcornIcon className="w-8 h-8" style={{ transform: 'rotate(12deg)' }} />
      </div>

      {/* Movie Poster + Info */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-2 gap-4 min-h-0">
       <div
        className="relative cursor-pointer group flex-shrink-0"
        onClick={() => navigate(`/movie/${recommendation.movieId}?type=${recommendation.mediaType || 'movie'}`)}
       >
        <img
         src={recommendation.poster}
         alt={recommendation.title}
         className="w-44 h-auto max-h-[50vh] object-cover border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] group-hover:scale-[1.02] transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
       </div>

       <div className="text-center space-y-1.5 max-w-[80%]">
        <h2 className="text-xl font-bold text-fg leading-tight">{recommendation.title}</h2>
        <p className="text-xs text-fg-2">
         {recommendation.year}
         {recommendation.runtime && ` \u2022 ${recommendation.runtime}`}
         {recommendation.director && ` \u2022 ${recommendation.director}`}
        </p>
        {recommendation.genres && recommendation.genres.length > 0 && (
         <div className="flex gap-1.5 justify-center flex-wrap">
          {recommendation.genres.map((g) => (
           <span key={g} className="text-[10px] px-2 py-0.5 bg-white/5 text-fg-2 border border-white/10">
            {g}
           </span>
          ))}
         </div>
        )}
        {recommendation.reason && (
         <p className="text-xs text-fg-3 italic leading-relaxed pt-1">
          &ldquo;{recommendation.reason}&rdquo;
         </p>
        )}
       </div>
      </div>

      {/* Action Buttons */}
      <div className="flex border-t border-line/60 bg-black/30 backdrop-blur-sm flex-shrink-0">
       <button
        onClick={() => handleRate('up')}
        disabled={isRating || isSkipping}
        className={`flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-medium transition-all border-r border-line/60 ${
         showSuccess === 'up' ? 'bg-green-500 text-fg' : 'text-green-400 hover:bg-green-900/30'
        } disabled:opacity-50`}
       >
        <ThumbsUp size={15} className={showSuccess === 'up' ? 'fill-current' : ''} />
        {showSuccess === 'up' ? 'Liked!' : 'Like'}
       </button>
       <button
        onClick={() => handleRate('down')}
        disabled={isRating || isSkipping}
        className={`flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-medium transition-all border-r border-line/60 ${
         showSuccess === 'down' ? 'bg-red-500 text-fg' : 'text-red-400 hover:bg-red-900/30'
        } disabled:opacity-50`}
       >
        <ThumbsDown size={15} className={showSuccess === 'down' ? 'fill-current' : ''} />
        {showSuccess === 'down' ? 'Noted!' : 'Pass'}
       </button>
       <button
        onClick={handleSkip}
        disabled={isRating || isSkipping}
        className="flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-medium text-fg-2 hover:bg-gray-800/50 transition-all border-r border-line/60 disabled:opacity-50"
       >
        <SkipForward size={15} /> Skip
       </button>
       <button
        onClick={handleAddRecToCalendar}
        disabled={isRating || isSkipping}
        className="flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-medium bg-white text-black hover:bg-gray-200 transition-all disabled:opacity-50"
       >
        <CalendarPlus size={15} /> Add
       </button>
      </div>

      {/* Refresh button */}
      <button
       onClick={() => refreshRecommendation()}
       disabled={recLoading}
       className="absolute top-4 right-5 p-2 text-fg-3 hover:text-fg hover:bg-gray-800/60 transition-colors disabled:opacity-50 z-10"
      >
       <RefreshCw size={16} className={recLoading ? 'animate-spin' : ''} />
      </button>
     </>
    ) : (
     <div className="flex-1 flex items-center justify-center text-fg-3 text-sm">
      No recommendation yet
     </div>
    )}
   </div>

   {/* ─── Date Strip ─── */}
   <div className="flex-shrink-0 bg-[#0c0c0e] border-t border-line/60 pb-[env(safe-area-inset-bottom)]">
    {/* Month/Year label */}
    <div className="flex items-center justify-between px-5 pt-3 pb-2">
     <button onClick={() => {
      const d = new Date(selectedDate); d.setDate(d.getDate() - 7); setSelectedDate(d);
     }} className="p-1 text-fg-3 hover:text-fg transition-colors">
      <ChevronLeft size={16} />
     </button>
     <span className="text-xs font-semibold text-fg-2 uppercase tracking-wider">
      {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
     </span>
     <button onClick={() => {
      const d = new Date(selectedDate); d.setDate(d.getDate() + 7); setSelectedDate(d);
     }} className="p-1 text-fg-3 hover:text-fg transition-colors">
      <ChevronRight size={16} />
     </button>
    </div>

    {/* Scrollable date cells */}
    <div
     ref={dateStripRef}
     className="flex gap-2 px-4 pb-4 overflow-x-auto scrollbar-hide"
     style={{ scrollSnapType: 'x mandatory' }}
    >
     {dateRange.map((date, i) => {
      const dayEvts = getEventsForDate(date);
      const primaryEvent = dayEvts[0];
      const hasEvent = Boolean(primaryEvent);
      const isToday = new Date().toDateString() === date.toDateString();
      const isSelected = selectedDate.toDateString() === date.toDateString();

      const accentStart = primaryEvent?.accentStart || DEFAULT_ACCENT.start;
      const accentEnd = primaryEvent?.accentEnd || DEFAULT_ACCENT.end;
      const accentText = primaryEvent?.accentText || DEFAULT_ACCENT.text;

      const distance = Math.abs(i - 14);
      const scale = Math.max(0.8, 1 - distance * 0.025);
      const opacity = Math.max(0.4, 1 - distance * 0.06);

      const cellStyle: React.CSSProperties = {
       transform: `scale(${isSelected ? 1.1 : scale})`,
       opacity: isSelected ? 1 : opacity,
       scrollSnapAlign: 'center',
       transition: 'transform 0.2s, opacity 0.2s',
      };

      const bgStyle: React.CSSProperties | undefined = hasEvent
       ? { backgroundImage: `radial-gradient(circle at top right, ${accentStart}, ${accentEnd})` }
       : undefined;

      return (
       <div
        key={date.toISOString()}
        onClick={() => handleDayClick(date, dayEvts.length > 0 ? dayEvts : undefined)}
        className={`flex-shrink-0 w-14 h-16 flex flex-col items-center justify-center cursor-pointer transition-all relative ${
         isSelected
          ? hasEvent
           ? 'ring-2 ring-white/40'
           : 'ring-2 ring-blue-500/60 bg-blue-900/20'
          : hasEvent
           ? 'shadow-lg'
           : isToday
            ? 'bg-blue-900/15 border border-blue-500/30'
            : 'bg-base-2 hover:bg-gray-800 border border-transparent'
        }`}
        style={{ ...cellStyle, ...bgStyle }}
       >
        <span className="text-[10px] font-bold uppercase" style={{ color: hasEvent ? accentText : isToday ? '#60a5fa' : '#6b7280' }}>
         {date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3)}
        </span>
        <span className="text-lg font-bold" style={{ color: hasEvent ? accentText : isToday ? '#60a5fa' : '#9ca3af' }}>
         {date.getDate()}
        </span>
        {dayEvts.length > 1 && (
         <span className="absolute -top-1 -right-1 text-[8px] font-bold w-4 h-4 bg-white/25 backdrop-blur-sm flex items-center justify-center" style={{ color: accentText }}>
          {dayEvts.length}
         </span>
        )}
        {hasEvent && dayEvts.length === 1 && (
         <div className="absolute -bottom-0.5 w-1.5 h-1.5 bg-white/40" />
        )}
       </div>
      );
     })}
    </div>
   </div>

   {/* ─── Modal ─── */}
   {isModalOpen && (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
     <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
     <div className="bg-base-2 w-full max-w-md rounded-t-3xl sm: p-6 shadow-2xl z-50 relative animate-in slide-in-from-bottom-full duration-300 border border-line overflow-hidden max-h-[85vh] overflow-y-auto">

      {viewMode !== 'details' && viewMode !== 'events' && (
       <div className="flex items-center justify-between mb-6">
        <div>
         <h2 className="text-xl font-bold text-fg">{editingEventId ? 'Edit Log' : isPast ? 'Log Watched Movie' : 'Plan a Movie'}</h2>
         <p className="text-sm text-fg-3">{selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
        </div>
       </div>
      )}

      {/* Events View */}
      {viewMode === 'events' && (
       <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
         <div>
          <h2 className="text-xl font-bold text-fg">Movies on this day</h2>
          <p className="text-sm text-fg-3">{selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
         </div>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
         {dayEvents.map((event) => (
          <div
           key={event.id}
           onClick={() => {
            const hydratedMovie: Movie = {
             id: event.movieId, title: event.title || 'Untitled',
             poster: event.poster || TMDB_POSTER_PLACEHOLDER,
             year: event.year ?? '----', runtime: event.runtimeLabel ?? 'Unknown',
             backdrop: event.backdrop, mediaType: event.mediaType,
             accentStart: event.accentStart, accentEnd: event.accentEnd, accentText: event.accentText,
            };
            setSelectedMovie(hydratedMovie);
            setInviteFriend(event.inviteFriend);
            setEditingEventId(event.id);
            setRating(event.rating || null);
            setViewMode('details');
            if (event.accentStart && event.accentEnd && event.accentText) {
             setSelectedAccent({ start: event.accentStart, end: event.accentEnd, text: event.accentText });
            }
           }}
           className="flex gap-3 p-3 bg-gray-900 hover:bg-gray-800 cursor-pointer transition-colors border border-line"
          >
           <img src={event.poster} className="w-12 h-16 object-cover rounded-lg" alt={event.title} />
           <div className="flex flex-col justify-center flex-1">
            <span className="font-semibold text-gray-200">{event.title}</span>
            <span className="text-xs text-fg-3">{event.year} {event.runtimeLabel && `\u2022 ${event.runtimeLabel}`}</span>
           </div>
           {event.rating && (
            <div className={`self-center px-2 py-1 text-xs font-bold ${event.rating === 'up' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
             {event.rating === 'up' ? '\uD83D\uDC4D' : '\uD83D\uDC4E'}
            </div>
           )}
          </div>
         ))}
        </div>
        <button
         onClick={() => { resetModalState(); setViewMode('search'); }}
         className="w-full py-4 font-bold text-lg bg-white hover:bg-gray-200 text-black flex items-center justify-center gap-2 transition-all"
        >
         <Plus size={20} /> Add Another Movie
        </button>
       </div>
      )}

      {/* Search View */}
      {viewMode === 'search' && (
       <div className="space-y-4">
        <div className="relative">
         <Search className="absolute left-3 top-3 text-fg-3" size={20} />
         <input
          type="text"
          placeholder={isPast ? 'What did you watch?' : 'Search for a movie...'}
          className="w-full bg-gray-900 py-3 pl-10 pr-4 text-fg placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all border border-line"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
         />
        </div>
        {searchError && <p className="text-xs text-red-400 px-1">{searchError}</p>}
        <div className="max-h-80 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-gray-700">
         {hasQuery ? (
          isSearchingMovies ? (
           <div className="flex items-center gap-2 text-fg-3 text-sm p-4">
            <Loader2 size={16} className="animate-spin" /> Searching TMDB...
           </div>
          ) : noMatches ? (
           <div className="text-sm text-fg-3 p-4">No matches for &ldquo;{searchQuery}&rdquo;. Try another title.</div>
          ) : (
           filteredMovies.map((movie) => (
            <div
             key={`${movie.mediaType ?? 'movie'}-${movie.id}`}
             onClick={() => { setSelectedMovie(movie); setMovieLogoUrl(null); setMovieHeroUrl(null); setViewMode('confirm'); }}
             className="flex gap-3 p-2 hover:bg-gray-800 cursor-pointer group transition-colors border border-transparent hover:border-line"
            >
             <img src={movie.poster} className="w-12 h-16 object-cover rounded-lg shadow-sm" alt={movie.title} />
             <div className="flex flex-col justify-center">
              <span className="font-semibold text-gray-200 group-hover:text-blue-400">{movie.title}</span>
              <span className="text-xs text-fg-3">{movie.year} \u2022 {movie.runtime}</span>
             </div>
            </div>
           ))
          )
         ) : isLoadingFeatured ? (
          <div className="flex items-center gap-2 text-fg-3 text-sm p-4">
           <Loader2 size={16} className="animate-spin" /> Loading trending...
          </div>
         ) : (
          filteredMovies.map((movie) => (
           <div
            key={`${movie.mediaType ?? 'movie'}-${movie.id}`}
            onClick={() => { setSelectedMovie(movie); setMovieLogoUrl(null); setMovieHeroUrl(null); setViewMode('confirm'); }}
            className="flex gap-3 p-2 hover:bg-gray-800 cursor-pointer group transition-colors border border-transparent hover:border-line"
           >
            <img src={movie.poster} className="w-12 h-16 object-cover rounded-lg shadow-sm" alt={movie.title} />
            <div className="flex flex-col justify-center">
             <span className="font-semibold text-gray-200 group-hover:text-blue-400">{movie.title}</span>
             <span className="text-xs text-fg-3">{movie.year} \u2022 {movie.runtime}</span>
            </div>
           </div>
          ))
         )}
        </div>
       </div>
      )}

      {/* Confirm View */}
      {viewMode === 'confirm' && selectedMovie && (
       <div className="space-y-6">
        <div className="relative overflow-hidden border border-line bg-gray-900">
         {(movieHeroUrl || selectedMovie.backdrop) && (
          <img src={movieHeroUrl ?? selectedMovie.backdrop} alt={selectedMovie.title} className="absolute inset-0 w-full h-full object-cover opacity-60" />
         )}
         <div className="absolute inset-0 bg-gradient-to-tr from-[#0b0b0f] via-black/60 to-transparent" />
         <div className="relative p-4 flex gap-4 items-center">
          <img src={selectedMovie.poster} className="w-20 border border-white/10 shadow-lg" alt="Selected" />
          <div className="flex-1">
           {movieLogoUrl ? (
            <img src={movieLogoUrl} alt={selectedMovie.title} className="max-h-10 object-contain mb-1" />
           ) : (
            <h3 className="font-bold text-fg text-lg leading-tight">{selectedMovie.title}</h3>
           )}
           <p className="text-sm text-gray-200">
            {selectedMovie.year} \u2022 {selectedMovie.runtime}
            {isLoadingLogo && <span className="text-[10px] text-blue-200/70 ml-2 uppercase tracking-wide">Fetching title art...</span>}
           </p>
           <button onClick={() => { setViewMode('search'); setSearchQuery(''); }} className="inline-flex items-center gap-1 text-xs text-blue-300 font-medium mt-3 hover:text-fg transition-colors">
            Change Movie
           </button>
          </div>
         </div>
        </div>

        {isPast ? (
         <div>
          <label className="text-sm font-bold text-fg-2 mb-3 block">How was it?</label>
          <div className="grid grid-cols-2 gap-3">
           <button onClick={() => setRating('up')} className={`flex flex-col items-center justify-center p-4 border-2 transition-all ${rating === 'up' ? 'border-green-500 bg-green-900/20 text-green-400' : 'border-line bg-gray-900 text-fg-3 hover:bg-gray-800'}`}>
            <ThumbsUp size={32} className={rating === 'up' ? 'fill-current' : ''} />
            <span className="mt-2 font-bold text-sm">Loved it</span>
           </button>
           <button onClick={() => setRating('down')} className={`flex flex-col items-center justify-center p-4 border-2 transition-all ${rating === 'down' ? 'border-red-500 bg-red-900/20 text-red-400' : 'border-line bg-gray-900 text-fg-3 hover:bg-gray-800'}`}>
            <ThumbsDown size={32} className={rating === 'down' ? 'fill-current' : ''} />
            <span className="mt-2 font-bold text-sm">Not for me</span>
           </button>
          </div>
         </div>
        ) : (
         <div>
          <label className="text-sm font-bold text-fg-2 mb-3 block">Who is watching?</label>
          <div className="flex flex-col gap-3">
           <div className={`flex items-center justify-between p-4 border-2 cursor-pointer transition-all ${!inviteFriend ? 'border-blue-600 bg-blue-900/10' : 'border-line bg-gray-900'}`} onClick={() => setInviteFriend(false)}>
            <div className="flex items-center gap-3">
             <div className="bg-gray-800 p-2 text-fg-2"><UserIcon size={18} /></div>
             <span className="font-medium text-gray-200">Just Me</span>
            </div>
            {!inviteFriend && <Check size={20} className="text-blue-500" />}
           </div>
           <div className={`p-4 border-2 transition-all ${inviteFriend ? 'border-purple-600 bg-purple-900/10' : 'border-line bg-gray-900'}`}>
            <div className="flex items-center justify-between gap-3">
             <div className="flex items-center gap-3 cursor-pointer" onClick={() => setInviteFriend(true)}>
              <div className="bg-gray-800 p-2 text-fg-2"><Users size={18} /></div>
              <div className="flex flex-col">
               <span className="font-medium text-gray-200">Watch with a friend</span>
               <span className="text-xs text-fg-3">Send an invite</span>
              </div>
             </div>
             <button type="button" onClick={() => setInviteFriend(true)} className="text-xs font-semibold px-3 py-1 border border-purple-500 text-fg hover:bg-fg-2/20 transition-colors">
              Invite
             </button>
            </div>
           </div>
          </div>
         </div>
        )}

        <button
         onClick={handleSaveEvent}
         disabled={(isPast && !rating) || isSaving}
         className={`w-full py-4 font-bold text-lg shadow-lg transform transition-transform active:scale-95 flex items-center justify-center gap-2 ${(isPast && !rating) || isSaving ? 'bg-gray-800 text-fg-3 cursor-not-allowed' : 'bg-white hover:bg-gray-200 text-black'}`}
        >
         {isSaving ? <Loader2 size={20} className="animate-spin" /> : editingEventId ? <Edit2 size={20} /> : <Plus size={20} />}
         {isSaving ? 'Saving...' : editingEventId ? 'Update Log' : isPast ? 'Log to History' : 'Add to Calendar'}
        </button>
       </div>
      )}

      {/* Details View */}
      {viewMode === 'details' && selectedMovie && (
       <div className="space-y-6">
        <div className="absolute top-4 right-4 z-20 flex gap-3">
         <button onClick={() => navigate(`/movie/${selectedMovie.id}?type=${selectedMovie.mediaType || 'movie'}`)} className="w-10 h-10 bg-blue-500 text-fg flex items-center justify-center shadow-lg hover:bg-blue-600 hover:scale-105 transition-all" title="View Full Details">
          <Info size={18} />
         </button>
         <button onClick={() => setViewMode('search')} className="w-10 h-10 bg-amber-400 text-black flex items-center justify-center shadow-lg hover:bg-amber-300 hover:scale-105 transition-all border border-amber-500/20" title="Swap Movie">
          <Repeat size={18} strokeWidth={2.5} />
         </button>
         <button onClick={handleDeleteEvent} className="w-10 h-10 bg-red-500 text-fg flex items-center justify-center shadow-lg hover:bg-red-600 hover:scale-105 transition-all" title="Delete Event">
          <Trash2 size={18} />
         </button>
        </div>
        <div className="relative overflow-hidden aspect-video bg-gray-900 group">
         {(movieHeroUrl || selectedMovie.backdrop) && (
          <img src={movieHeroUrl ?? selectedMovie.backdrop} className="absolute inset-0 w-full h-full object-cover opacity-60" />
         )}
         <div className="absolute inset-0 bg-gradient-to-t from-[#18181b] to-transparent" />
         <div className="absolute bottom-0 left-0 p-4 flex gap-3 items-end w-full">
          <img src={selectedMovie.poster} className="w-20 rounded-lg border-2 border-white/10 shadow-xl" />
          <div className="mb-1 flex-1">
           {movieLogoUrl ? (
            <img src={movieLogoUrl} alt={selectedMovie.title} className="max-h-10 object-contain mb-1" />
           ) : (
            <h3 className="font-bold text-fg text-xl leading-none mb-1">{selectedMovie.title}</h3>
           )}
           <p className="text-fg-2 text-xs">{selectedMovie.runtime}</p>
          </div>
         </div>
        </div>
       </div>
      )}

      {/* Success View */}
      {viewMode === 'success' && lastSavedMovie && (
       <div className="space-y-6 text-center">
        <div className="flex flex-col items-center py-4">
         <div className="w-20 h-20 bg-green-500/20 flex items-center justify-center mb-4">
          <Check size={40} className="text-green-400" />
         </div>
         <h2 className="text-2xl font-bold text-fg mb-1">Movie Logged!</h2>
         <p className="text-fg-2 text-sm">{selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-4 items-center bg-gray-900 p-4 border border-line">
         <img src={lastSavedMovie.poster} className="w-16 h-24 object-cover rounded-lg shadow-lg" alt={lastSavedMovie.title} />
         <div className="flex-1 text-left">
          <h3 className="font-bold text-fg text-lg">{lastSavedMovie.title}</h3>
          <p className="text-sm text-fg-2">{lastSavedMovie.year} \u2022 {lastSavedMovie.runtime}</p>
         </div>
         <div className={`w-12 h-12 flex items-center justify-center ${lastSavedRating === 'up' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {lastSavedRating === 'up' ? <ThumbsUp size={24} className="fill-current" /> : <ThumbsDown size={24} className="fill-current" />}
         </div>
        </div>
        <div className="space-y-3 pt-2">
         <button
          onClick={() => { setSelectedMovie(null); setSearchQuery(''); setRating(null); setLastSavedMovie(null); setLastSavedRating(null); setViewMode('search'); }}
          className="w-full py-4 font-bold text-lg bg-white hover:bg-gray-200 text-black flex items-center justify-center gap-2 transition-all"
         >
          <Plus size={20} /> Add Another Movie
         </button>
         <button
          onClick={() => { setIsModalOpen(false); setLastSavedMovie(null); setLastSavedRating(null); }}
          className="w-full py-3 font-medium text-fg-2 hover:text-fg hover:bg-gray-800 transition-all"
         >
          Done
         </button>
        </div>
       </div>
      )}
     </div>
    </div>
   )}
  </div>
 );
}
