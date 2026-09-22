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

type WhereToWatchProps = {
  providers: WatchProviders | null;
};

function Mark({ offer, compact }: { offer: WatchOffer; compact?: boolean }) {
  const key = whiteMarkKey(offer.id, offer.name);
  const box = compact ? 'h-7 w-7' : 'h-8 w-8';
  const icon = compact ? 'h-4 w-4' : 'h-5 w-5';
  if (key) {
    return (
      <span className={`flex ${box} shrink-0 items-center justify-center border border-line bg-base`}>
        <img src={`/providers/${key}.svg`} alt="" className={`${icon} object-contain`} />
      </span>
    );
  }
  const tile = tmdbLogoUrl(offer.logoPath);
  if (tile) {
    return <img src={tile} alt="" className={`${box} shrink-0 object-cover`} />;
  }
  return (
    <span className={`flex ${box} shrink-0 items-center justify-center bg-base text-[11px] text-fg-3`}>
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

  const ordered = groups.flatMap((group) => group.offers);
  const stack = ordered.slice(0, 4);
  const count = ordered.length;
  const countLabel = count === 1 ? '1 service' : `${count} services`;

  return (
    <div data-testid="where-to-watch">
      <button
        type="button"
        className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-white/5 bg-[#18181b] px-4 py-3 text-left"
        data-testid="where-to-watch-bar"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="flex shrink-0">
          {stack.map((offer, index) => (
            <span key={`${offer.id}-${index}`} className={index === 0 ? '' : '-ml-2'} style={{ zIndex: stack.length - index }}>
              <Mark offer={offer} compact />
            </span>
          ))}
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium text-fg">Where to watch</span>
        <span className="shrink-0 text-sm text-fg-3" data-testid="where-to-watch-count">
          {countLabel}
        </span>
      </button>

      <div hidden={!open} data-testid="where-to-watch-sheet">
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60"
          aria-label="Close where to watch"
          data-testid="where-to-watch-scrim"
          onClick={() => setOpen(false)}
        />
        <div className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border border-white/10 bg-[#18181b] px-4 pb-8 pt-3">
          <button
            type="button"
            className="mx-auto mb-3 block h-1 w-10 rounded-full bg-line"
            aria-label="Close"
            data-testid="where-to-watch-grab"
            onClick={() => setOpen(false)}
          />
          <h3 className="mb-3 text-base font-semibold text-fg">Where to watch</h3>
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.kind}>
                <p className="mb-1 font-spec text-[10px] uppercase tracking-widest text-fg-3">
                  {WATCH_GROUP_LABEL[group.kind]}
                </p>
                {group.offers.map((offer) => (
                  <OfferRow key={`${group.kind}-${offer.id}`} offer={offer} kind={group.kind} href={providers.link} />
                ))}
              </div>
            ))}
          </div>
          {providers.link && (
            <p className="mt-4 text-[11px] text-fg-3">
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
        </div>
      </div>
    </div>
  );
}
