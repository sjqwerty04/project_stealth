import { useState } from 'react';
import {
  WATCH_GROUP_LABEL,
  WATCH_GROUP_ORDER,
  tmdbLogoUrl,
  whiteMarkKey,
  type WatchOffer,
  type WatchOfferKind,
  type WatchProviders,
} from '../lib/watchProviders';

const PREVIEW_COUNT = 3;

type WhereToWatchProps = {
  providers: WatchProviders | null;
};

function Mark({ offer }: { offer: WatchOffer }) {
  const key = whiteMarkKey(offer.id, offer.name);
  if (key) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-base">
        <img src={`/providers/${key}.svg`} alt="" className="h-5 w-5 object-contain" />
      </span>
    );
  }
  const tile = tmdbLogoUrl(offer.logoPath);
  if (tile) {
    return <img src={tile} alt="" className="h-8 w-8 shrink-0 object-cover" />;
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-base text-[11px] text-fg-3">
      {offer.name.slice(0, 1)}
    </span>
  );
}

function OfferRow({ offer, kind, href }: { offer: WatchOffer; kind: WatchOfferKind; href: string | null }) {
  const label = WATCH_GROUP_LABEL[kind];
  const body = (
    <>
      <Mark offer={offer} />
      <span className="min-w-0 flex-1 truncate text-sm text-fg">{offer.name}</span>
      <span className="font-spec text-[10px] uppercase tracking-widest text-fg-3">{label}</span>
    </>
  );
  const className = 'flex min-h-11 items-center gap-3';
  if (!href) {
    return (
      <div className={className} data-testid={`where-to-watch-offer-${kind}-${offer.id}`}>
        {body}
      </div>
    );
  }
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={`where-to-watch-offer-${kind}-${offer.id}`}
    >
      {body}
    </a>
  );
}

export default function WhereToWatch({ providers }: WhereToWatchProps) {
  const [open, setOpen] = useState(false);
  if (!providers) return null;

  const groups = WATCH_GROUP_ORDER
    .map((kind) => ({ kind, offers: providers[kind] }))
    .filter((group) => group.offers.length > 0);
  if (groups.length === 0) return null;

  const truncated = groups.some((group) => group.offers.length > PREVIEW_COUNT);

  return (
    <section className="rounded-2xl border border-white/5 bg-[#18181b] p-4" data-testid="where-to-watch">
      <h3 className="mb-3 font-spec text-[10px] uppercase tracking-widest text-fg-3">Where to watch</h3>
      <div className="space-y-4">
        {groups.map((group) => {
          const shown = open ? group.offers : group.offers.slice(0, PREVIEW_COUNT);
          return (
            <div key={group.kind}>
              <p className="mb-1 font-spec text-[10px] uppercase tracking-widest text-fg-3">
                {WATCH_GROUP_LABEL[group.kind]}
              </p>
              <div>
                {shown.map((offer) => (
                  <OfferRow key={offer.id} offer={offer} kind={group.kind} href={providers.link} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {truncated && (
        <button
          type="button"
          className="mt-3 min-h-11 text-sm font-medium text-fg-2"
          data-testid="where-to-watch-see-all"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Show less' : 'See all'}
        </button>
      )}
      {providers.link && (
        <p className="mt-3 text-[11px] text-fg-3">
          Powered by{' '}
          <a
            href={providers.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-fg-2"
            data-testid="where-to-watch-credit"
          >
            JustWatch
          </a>
        </p>
      )}
    </section>
  );
}
