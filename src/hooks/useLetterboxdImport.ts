import { useCallback, useState } from 'react';
import { emptyBundle, type ImportBundle } from '../lib/library';
import { useLibraryImport } from './useLibraryImport';

const CORS_PROXIES = ['https://corsproxy.io/?', 'https://api.codetabs.com/v1/proxy?quest='];

/** Our own function first, since Letterboxd serves the feed to a server with browser headers. Public proxies are the fallback. */
function feedUrls(username: string): string[] {
  const rssUrl = `https://letterboxd.com/${username}/rss/`;
  return [`/api/letterboxd-rating?rss=${encodeURIComponent(username)}`, ...CORS_PROXIES.map((p) => `${p}${encodeURIComponent(rssUrl)}`)];
}

/** The public RSS feed is the last ~50 diary entries. The export zip is the full library. */
export function bundleFromRss(xmlText: string): ImportBundle {
  const bundle = emptyBundle('letterboxd');
  const parser = new DOMParser();
  const docXml = parser.parseFromString(xmlText, 'text/xml');
  const items = docXml.querySelectorAll('item');
  const seen = new Map<string, number>();

  items.forEach((item) => {
    const title = item.querySelector('title')?.textContent || '';
    const link = item.querySelector('link')?.textContent || '';
    const pubDate = item.querySelector('pubDate')?.textContent || '';
    const watched = item.getElementsByTagName('letterboxd:watchedDate')[0]?.textContent || '';
    const rewatch = /yes/i.test(item.getElementsByTagName('letterboxd:rewatch')[0]?.textContent || '');
    const ratingText = item.getElementsByTagName('letterboxd:memberRating')[0]?.textContent || '';
    const match = title.match(/^(.+?),\s*(\d{4})(?:\s*-\s*(.+))?$/);
    if (!match) return;
    const name = match[1].trim();
    const year = match[2];
    let stars: number | undefined = ratingText ? Number(ratingText) : undefined;
    if (stars == null && match[3]) {
      const full = (match[3].match(/★/g) || []).length;
      stars = full + (match[3].includes('½') ? 0.5 : 0);
    }
    if (stars != null && (!Number.isFinite(stars) || stars <= 0)) stars = undefined;
    const day = watched || (pubDate ? new Date(pubDate).toISOString().slice(0, 10) : '');
    const key = `${name.toLowerCase()}|${year}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
    const existing = bundle.films.find((f) => `${f.title.toLowerCase()}|${f.year}` === key);
    if (existing) {
      if (existing.stars == null && stars != null) existing.stars = stars;
      existing.watchCount = seen.get(key);
    } else {
      bundle.films.push({ title: name, year, stars, watched: true, letterboxdUri: link, watchCount: 1 });
    }
    if (day) bundle.diary.push({ title: name, year, watchedDate: day.slice(0, 10), stars, rewatch, tags: [] });
  });

  bundle.meta.counts = { diary: bundle.diary.length, films: bundle.films.length };
  bundle.meta.filesSeen = ['rss'];
  return bundle;
}

export function useLetterboxdImport() {
  const library = useLibraryImport();
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  const importFromLetterboxd = useCallback(
    async (username: string): Promise<number> => {
      setError(null);
      setImportedCount(0);
      let xmlText = '';
      for (const url of feedUrls(username.trim())) {
        try {
          const res = await fetch(url);
          if (res.status === 404) {
            setError(`User "${username}" not found on Letterboxd`);
            return 0;
          }
          if (res.ok) {
            xmlText = await res.text();
            if (xmlText.includes('<rss') || xmlText.includes('<channel')) break;
            xmlText = '';
          }
        } catch {
          /* try the next proxy */
        }
      }
      if (!xmlText) {
        setError('Could not fetch that Letterboxd feed. Drop the export zip instead.');
        return 0;
      }
      const bundle = bundleFromRss(xmlText);
      if (!bundle.films.length) {
        setError('No films found in the diary. Is the profile public?');
        return 0;
      }
      bundle.meta.username = username.trim();
      const result = await library.importBundle(bundle);
      const count = result ? result.films : 0;
      setImportedCount(count);
      if (!result) setError(library.error ?? 'Import failed. Please try again.');
      return count;
    },
    [library],
  );

  return {
    importFromLetterboxd,
    isImporting: library.isImporting,
    progress: { current: library.progress.done, total: library.progress.total },
    error: error ?? library.error,
    importedCount,
  };
}
