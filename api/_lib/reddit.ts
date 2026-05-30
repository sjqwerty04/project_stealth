// Shared Reddit retrieval used by serverless routes (reddit-context, movie-chat).
// Read-only public JSON endpoints — no auth needed, but a descriptive User-Agent
// reduces the chance of being rate-limited. Datacenter IPs are sometimes blocked
// (403); callers must handle the empty/blocked result gracefully.

const REDDIT_HEADERS = {
  'User-Agent': 'web:movie-selects:v1.0 (movie discovery app)',
  Accept: 'application/json',
};

export type RedditSnippet = { text: string; score: number; url: string };
export type RedditContext = { snippets: RedditSnippet[]; threadTitles: string[]; blocked: boolean };

const stripHtml = (s: string): string =>
  (s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

export async function fetchRedditContext(title: string, year?: string): Promise<RedditContext> {
  const empty: RedditContext = { snippets: [], threadTitles: [], blocked: false };
  if (!title) return empty;

  try {
    const query = encodeURIComponent(`${title} ${year || ''} movie`.trim());
    const searchUrl = `https://www.reddit.com/search.json?q=${query}&sort=relevance&limit=8&type=link`;
    const searchRes = await fetch(searchUrl, { headers: REDDIT_HEADERS });

    if (searchRes.status === 403 || searchRes.status === 429) {
      return { ...empty, blocked: true };
    }
    if (!searchRes.ok) return empty;

    const searchData = await searchRes.json();
    const posts: any[] = (searchData?.data?.children || [])
      .map((c: any) => c.data)
      .filter((p: any) => p && p.permalink)
      .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
      .slice(0, 3);

    const threadTitles = posts.map((p) => stripHtml(p.title)).filter(Boolean);
    const snippets: RedditSnippet[] = [];

    // Seed with post titles + selftext.
    for (const p of posts) {
      const body = stripHtml(p.selftext || '').slice(0, 400);
      const text = body ? `${stripHtml(p.title)} — ${body}` : stripHtml(p.title);
      if (text) snippets.push({ text, score: p.score || 0, url: `https://www.reddit.com${p.permalink}` });
    }

    // Pull top comments from the best couple of threads.
    for (const p of posts.slice(0, 2)) {
      try {
        const commentsRes = await fetch(`https://www.reddit.com${p.permalink}.json?limit=30&sort=top`, {
          headers: REDDIT_HEADERS,
        });
        if (!commentsRes.ok) continue;
        const commentsData = await commentsRes.json();
        const listing = commentsData?.[1]?.data?.children || [];
        for (const c of listing) {
          const body = stripHtml(c?.data?.body || '');
          const score = c?.data?.score || 0;
          if (body.length > 40 && body.length < 600 && score > 5) {
            snippets.push({ text: body, score, url: `https://www.reddit.com${p.permalink}` });
          }
          if (snippets.length >= 25) break;
        }
      } catch {
        // skip this thread
      }
      if (snippets.length >= 25) break;
    }

    // Keep the highest-signal snippets, capped for prompt size.
    const ranked = snippets.sort((a, b) => b.score - a.score).slice(0, 18);
    return { snippets: ranked, threadTitles, blocked: false };
  } catch (err) {
    console.error('fetchRedditContext failed:', err);
    return empty;
  }
}

// Compact the snippets into a single grounding block for prompts.
export function snippetsToPromptBlock(snippets: RedditSnippet[], maxChars = 6000): string {
  let out = '';
  for (const s of snippets) {
    const line = `- ${s.text}\n`;
    if (out.length + line.length > maxChars) break;
    out += line;
  }
  return out.trim();
}
