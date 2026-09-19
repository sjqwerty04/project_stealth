export function normalizeFilmTitle(title: string): string {
  return title
    .trim()
    .toLocaleLowerCase()
    .replace(/^the\s+/u, '')
    .replace(/[^a-z0-9]+/giu, ' ')
    .trim();
}

export function hydratedTitleMatchesPick(pickTitle: string, hydratedTitle: string): boolean {
  const pick = normalizeFilmTitle(pickTitle);
  const hydrated = normalizeFilmTitle(hydratedTitle);
  if (!pick || !hydrated) return false;
  return pick === hydrated || pick.startsWith(`${hydrated} `) || hydrated.startsWith(`${pick} `);
}

export function whyMatchNamesRecommended(whyMatch: string, recommendedTitle: string): boolean {
  const why = whyMatch.trim();
  const title = recommendedTitle.trim();
  if (!why || !title) return false;
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'iu').test(why);
}

/** Titles Grok may write for a diary film: the full item, plus the bit before a colon. */
export function mentionNeedles(title: string): string[] {
  const trimmed = title.trim();
  if (!trimmed) return [];
  const needles = [trimmed];
  const colon = trimmed.indexOf(':');
  if (colon >= 2) {
    const prefix = trimmed.slice(0, colon).trim();
    if (prefix.length >= 2 && !(prefix.length < 4 && /^[\p{L}]+$/u.test(prefix))) {
      needles.push(prefix);
    }
  }
  return [...new Set(needles)];
}
