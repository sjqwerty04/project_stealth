import { buildImageUrl } from '../lib/tmdb';

type Provider = { name: string; logoPath: string };

type WhereToWatchProps = {
  providers: {
    flatrate: Provider[];
    rent: Provider[];
    buy: Provider[];
  } | null;
  /** Region the availability data applies to. Only US is wired up today. */
  region?: string;
};

const providerLogoUrl = (logoPath: string) => buildImageUrl(logoPath, 'w92', '');

function ProviderRow({ label, providers }: { label: string; providers: Provider[] }) {
  if (providers.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-gray-500 uppercase tracking-wider w-12 shrink-0">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {providers.map((provider) => (
          <div
            key={`${label}-${provider.name}`}
            className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg bg-white/5 border border-white/5"
            title={provider.name}
          >
            {provider.logoPath && (
              <img
                src={providerLogoUrl(provider.logoPath)}
                alt=""
                className="w-5 h-5 rounded"
                loading="lazy"
              />
            )}
            <span className="text-xs text-gray-200">{provider.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Answers "where can I actually watch this" from data already fetched by
 * useMovieDetails, so it costs no additional request.
 *
 * The JustWatch credit is not decoration: TMDB's terms require attribution on
 * each media item that displays their watch-provider data, and non-compliance is
 * grounds for revoking API access.
 */
export default function WhereToWatch({ providers, region = 'US' }: WhereToWatchProps) {
  const hasAny =
    providers && (providers.flatrate.length > 0 || providers.rent.length > 0 || providers.buy.length > 0);

  return (
    <div className="bg-[#18181b] rounded-2xl p-4 border border-white/5">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Where to Watch <span className="text-gray-600 normal-case font-normal">({region})</span>
      </h3>

      {hasAny ? (
        <div className="space-y-2.5">
          <ProviderRow label="Stream" providers={providers.flatrate} />
          <ProviderRow label="Rent" providers={providers.rent} />
          <ProviderRow label="Buy" providers={providers.buy} />
        </div>
      ) : (
        // Saying "we don't know" beats guessing. A confident wrong answer costs the
        // user the exact trip to the wrong app they came here to avoid.
        <p className="text-xs text-gray-500">
          No {region} streaming availability found for this title.
        </p>
      )}

      <p className="text-[10px] text-gray-600 mt-3">
        Streaming availability data provided by{' '}
        <a
          href="https://www.justwatch.com/"
          target="_blank"
          rel="noreferrer noopener"
          className="underline hover:text-gray-400"
        >
          JustWatch
        </a>
      </p>
    </div>
  );
}
