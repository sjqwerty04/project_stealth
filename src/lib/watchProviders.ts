export type WatchOffer = {
  id: number;
  name: string;
  logoPath: string | null;
  priority: number;
};

export type WatchProviders = {
  link: string | null;
  stream: WatchOffer[];
  rent: WatchOffer[];
  buy: WatchOffer[];
  free: WatchOffer[];
  ads: WatchOffer[];
};

export type WatchOfferKind = keyof Omit<WatchProviders, 'link'>;

export const WATCH_GROUP_ORDER: WatchOfferKind[] = ['stream', 'free', 'ads', 'rent', 'buy'];

export const WATCH_GROUP_LABEL: Record<WatchOfferKind, string> = {
  stream: 'Stream',
  free: 'Free',
  ads: 'Ads',
  rent: 'Rent',
  buy: 'Buy',
};

const TMDB_KIND: Record<string, WatchOfferKind> = {
  flatrate: 'stream',
  free: 'free',
  ads: 'ads',
  rent: 'rent',
  buy: 'buy',
};

// Channel add-ons share the parent mark. "Paramount+ Amazon Channel" is Paramount, not Amazon.
const CHANNEL_SUFFIX = /\s+(amazon channel|roku premium channel|apple tv channel)$/i;

const MARK_RULES: [RegExp, string][] = [
  [/youtube tv/, 'youtubetv'],
  [/google play/, 'googleplay'],
  [/netflix/, 'netflix'],
  [/paramount/, 'paramountplus'],
  [/prime/, 'primevideo'],
  [/fubo/, 'fubo'],
  [/apple/, 'appletv'],
  [/fandango|vudu/, 'fandango'],
  [/youtube/, 'youtube'],
  [/amazon/, 'amazon'],
  [/\bmax\b|hbo max/, 'max'],
  [/mubi/, 'mubi'],
  [/tubi/, 'tubi'],
  [/\bplex\b/, 'plex'],
  [/roku/, 'roku'],
];

const MARK_BY_ID: Record<number, string> = {
  2: 'appletv',
  3: 'googleplay',
  8: 'netflix',
  9: 'amazon',
  10: 'amazon',
  11: 'mubi',
  73: 'tubi',
  119: 'primevideo',
  192: 'youtube',
  257: 'fubo',
  350: 'appletv',
  384: 'max',
  531: 'paramountplus',
  538: 'plex',
  1899: 'max',
  2100: 'primevideo',
};

type TmdbProvider = {
  provider_id?: unknown;
  provider_name?: unknown;
  logo_path?: unknown;
  display_priority?: unknown;
};

function asList(value: unknown): TmdbProvider[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is TmdbProvider => !!item && typeof item === 'object');
}

function normalizeOffers(value: unknown): WatchOffer[] {
  const byId = new Map<number, WatchOffer>();
  for (const raw of asList(value)) {
    if (typeof raw.provider_id !== 'number' || typeof raw.provider_name !== 'string' || !raw.provider_name) continue;
    const offer: WatchOffer = {
      id: raw.provider_id,
      name: raw.provider_name,
      logoPath: typeof raw.logo_path === 'string' && raw.logo_path ? raw.logo_path : null,
      priority: typeof raw.display_priority === 'number' ? raw.display_priority : 9999,
    };
    const prev = byId.get(offer.id);
    if (!prev || offer.priority < prev.priority) byId.set(offer.id, offer);
  }
  return [...byId.values()].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
}

export function parseWatchProviders(country: unknown): WatchProviders | null {
  if (!country || typeof country !== 'object') return null;
  const node = country as Record<string, unknown>;
  const groups = {} as Record<WatchOfferKind, WatchOffer[]>;
  for (const [tmdbKey, kind] of Object.entries(TMDB_KIND)) {
    groups[kind] = normalizeOffers(node[tmdbKey]);
  }
  const any = WATCH_GROUP_ORDER.some((kind) => groups[kind].length > 0);
  if (!any) return null;
  return {
    link: typeof node.link === 'string' && node.link ? node.link : null,
    stream: groups.stream,
    free: groups.free,
    ads: groups.ads,
    rent: groups.rent,
    buy: groups.buy,
  };
}

export function whiteMarkKey(id: number, name: string): string | null {
  const parent = name.toLowerCase().replace(CHANNEL_SUFFIX, '').trim();
  for (const [rule, key] of MARK_RULES) {
    if (rule.test(parent)) return key;
  }
  return MARK_BY_ID[id] ?? null;
}

export function tmdbLogoUrl(logoPath: string | null): string | null {
  if (!logoPath) return null;
  const path = logoPath.startsWith('/') ? logoPath : `/${logoPath}`;
  return `https://image.tmdb.org/t/p/w92${path}`;
}
