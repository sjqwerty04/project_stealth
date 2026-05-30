import type { VercelRequest, VercelResponse } from '@vercel/node';

const LB_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function extractRatingFromHtml(html: string): string | null {
  // Try JSON-LD blocks first
  const ldJsonMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of ldJsonMatches) {
    try {
      const data = JSON.parse(match[1]);
      const ratingValue =
        data?.aggregateRating?.ratingValue ??
        (Array.isArray(data) ? data.find((d: any) => d?.aggregateRating)?.aggregateRating?.ratingValue : undefined);
      if (ratingValue != null) {
        return String(ratingValue);
      }
    } catch {
      // continue to next block
    }
  }

  // Fallback: regex scan
  const ratingMatch = html.match(/"ratingValue":\s*([\d.]+)/);
  if (ratingMatch) return ratingMatch[1];

  return null;
}

async function fetchWithLbHeaders(url: string): Promise<Response> {
  return fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': LB_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const tmdbId = typeof req.query.tmdbId === 'string' ? req.query.tmdbId : '';
  const title = typeof req.query.title === 'string' ? req.query.title : '';
  const year = typeof req.query.year === 'string' ? req.query.year : '';

  try {
    let filmUrl: string | null = null;
    let html = '';

    // Step 1: Try TMDB redirect via Letterboxd
    if (tmdbId) {
      try {
        const tmdbRedirectUrl = `https://letterboxd.com/tmdb/${tmdbId}/`;
        const tmdbRes = await fetchWithLbHeaders(tmdbRedirectUrl);

        if (tmdbRes.ok || tmdbRes.status === 200) {
          const finalUrl = tmdbRes.url;
          // Check that a real redirect happened (not still on the /tmdb/ path)
          if (!finalUrl.includes('/tmdb/')) {
            filmUrl = finalUrl;
            html = await tmdbRes.text();
          }
        }
      } catch (tmdbErr) {
        console.warn('Letterboxd TMDB redirect failed:', tmdbErr);
      }
    }

    // Step 2: Fall back to search if we don't have a film page yet
    if (!filmUrl && title) {
      try {
        const searchQuery = encodeURIComponent(`${title} ${year}`);
        const searchUrl = `https://letterboxd.com/search/films/${searchQuery}/`;
        const searchRes = await fetchWithLbHeaders(searchUrl);

        if (searchRes.ok) {
          const searchHtml = await searchRes.text();

          // Find the first /film/<slug>/ href
          const slugMatch = searchHtml.match(/href="(\/film\/[^/"]+\/)"/);
          if (slugMatch) {
            const slug = slugMatch[1].replace(/^\/film\//, '').replace(/\/$/, '');
            const filmPageUrl = `https://letterboxd.com/film/${slug}/`;
            const filmRes = await fetchWithLbHeaders(filmPageUrl);

            if (filmRes.ok) {
              filmUrl = filmRes.url;
              html = await filmRes.text();
            }
          }
        }
      } catch (searchErr) {
        console.warn('Letterboxd search fallback failed:', searchErr);
      }
    }

    if (!html) {
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
      return res.status(200).json({ rating: null, filmUrl: null });
    }

    const rating = extractRatingFromHtml(html);

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({ rating, filmUrl });
  } catch (err: any) {
    console.error('letterboxd-rating error:', err);
    // Graceful null — never throw a 5xx for a supplementary data source
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({ rating: null, filmUrl: null });
  }
}
