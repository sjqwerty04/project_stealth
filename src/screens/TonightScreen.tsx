import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Play, RotateCcw } from 'lucide-react';
import { useTonight } from '../hooks/useTonight';
import { buildImageUrl, formatRuntime } from '../lib/tmdb';
import { explainOverlap, facetTerms } from '../lib/facets';
import type { Candidate, Constraints } from '../lib/constraints';
import type { CommitAction } from '../lib/decisionMetrics';
import AttributionNotice from '../components/AttributionNotice';

/**
 * Three taps to a decision.
 *
 * Everything here is rendered from a queue that was already on the device, so
 * changing a constraint re-ranks in memory rather than costing a round trip.
 * There is no "show more" and no infinite grid: unbounded options are the
 * problem this screen exists to solve.
 */

type Option<T> = { value: T; label: string };

const RUNTIME_OPTIONS: Option<Constraints['runtime']>[] = [
  { value: 'short', label: 'Under 90' },
  { value: 'medium', label: 'Under 2h' },
  { value: 'any', label: 'However long' },
];

const ENERGY_OPTIONS: Option<Constraints['energy']>[] = [
  { value: 'low', label: 'Nothing left' },
  { value: 'medium', label: 'Some' },
  { value: 'high', label: 'Wide awake' },
];

const COMPANY_OPTIONS: Option<Constraints['company']>[] = [
  { value: 'alone', label: 'Alone' },
  { value: 'two', label: 'Two' },
  { value: 'group', label: 'A room' },
];

function ConstraintRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="mb-4">
      <div className="text-[11px] uppercase tracking-[0.08em] text-gray-500 mb-2 font-mono">
        {label}
      </div>
      <div className="flex gap-2" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              className={`flex-1 py-2.5 px-2 rounded-lg text-sm transition-colors border ${
                active
                  ? 'bg-white text-black border-white font-medium'
                  : 'bg-[#18181b] text-gray-400 border-white/10 hover:border-white/25'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PickCard({
  candidate,
  index,
  neighbour,
  onCommit,
}: {
  candidate: Candidate;
  index: number;
  neighbour: Candidate | undefined;
  onCommit: (candidate: Candidate, action: CommitAction) => void;
}) {
  // The shared facets with the next pick are the honest answer to "how are these
  // different?", which is the question that stalls a decision.
  const overlap = neighbour ? explainOverlap(candidate.facets, neighbour.facets) : null;
  const terms = facetTerms(candidate.facets).slice(0, 4);

  return (
    <article className="bg-[#18181b] border border-white/10 rounded-xl overflow-hidden">
      <div className="flex gap-3 p-3">
        <img
          src={buildImageUrl(candidate.posterPath, 'w200')}
          alt=""
          className="w-20 h-30 rounded-md object-cover flex-shrink-0 bg-[#27272a]"
          loading={index === 0 ? 'eager' : 'lazy'}
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-white font-semibold leading-tight">{candidate.title}</h2>
          <div className="text-[11px] font-mono text-gray-500 mt-1 tabular-nums">
            {[candidate.year, formatRuntime(candidate.runtimeMinutes)].filter(Boolean).join(' · ')}
          </div>
          <p className="text-sm text-gray-300 mt-2 leading-snug">{candidate.reason}</p>
          {terms.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 mt-2.5">
              {terms.map((term) => (
                <li
                  key={term}
                  className="text-[10px] font-mono uppercase tracking-[0.08em] text-gray-400 border border-white/10 rounded px-1.5 py-0.5"
                >
                  {term}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {overlap && (
        <div className="px-3 pb-2 text-[11px] font-mono text-gray-600">
          shares with the next: {overlap}
        </div>
      )}

      <div className="flex border-t border-white/10">
        <button
          type="button"
          onClick={() => onCommit(candidate, 'play')}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm text-white hover:bg-white/5 transition-colors"
        >
          <Play className="w-4 h-4" /> Watch it
        </button>
        <button
          type="button"
          onClick={() => onCommit(candidate, 'tonight')}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm text-gray-300 border-l border-white/10 hover:bg-white/5 transition-colors"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => onCommit(candidate, 'log')}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm text-gray-300 border-l border-white/10 hover:bg-white/5 transition-colors"
        >
          <Check className="w-4 h-4" /> Seen it
        </button>
      </div>
    </article>
  );
}

export default function TonightScreen() {
  const navigate = useNavigate();
  const {
    constraints,
    setConstraints,
    picks,
    relaxedRuntime,
    isColdStart,
    isRefilling,
    error,
    commit,
    rejectAll,
  } = useTonight();

  const [committed, setCommitted] = useState<Candidate | null>(null);

  const handleCommit = (candidate: Candidate, action: CommitAction) => {
    commit(candidate, action);
    setCommitted(candidate);
  };

  if (committed) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center px-6 text-center">
        <img
          src={buildImageUrl(committed.posterPath, 'w500')}
          alt=""
          className="w-40 rounded-lg shadow-2xl mb-6"
        />
        <div className="text-white text-2xl font-semibold">{committed.title}</div>
        <p className="text-gray-500 text-sm mt-2 font-mono">That's the evening sorted.</p>
        <button
          type="button"
          onClick={() => setCommitted(null)}
          className="mt-8 text-sm text-gray-400 underline underline-offset-4"
        >
          Pick something else
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] pb-16">
      <header className="flex items-center gap-3 px-4 py-4">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="text-gray-400">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-white text-lg font-semibold">Tonight</h1>
      </header>

      <div className="px-4">
        <ConstraintRow
          label="How long have you got"
          options={RUNTIME_OPTIONS}
          value={constraints.runtime}
          onChange={(runtime) => setConstraints({ ...constraints, runtime })}
        />
        <ConstraintRow
          label="How much brain"
          options={ENERGY_OPTIONS}
          value={constraints.energy}
          onChange={(energy) => setConstraints({ ...constraints, energy })}
        />
        <ConstraintRow
          label="Who's watching"
          options={COMPANY_OPTIONS}
          value={constraints.company}
          onChange={(company) => setConstraints({ ...constraints, company })}
        />
      </div>

      <div className="px-4 mt-6 space-y-3">
        {isColdStart && (
          <div className="flex flex-col items-center py-16 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mb-3" />
            <span className="text-sm font-mono">Reading your taste. Once.</span>
          </div>
        )}

        {!isColdStart && error && picks.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-12">{error}</p>
        )}

        {relaxedRuntime && picks.length > 0 && (
          <p className="text-[11px] font-mono text-amber-500/80">
            Nothing that short tonight. These run over.
          </p>
        )}

        {picks.map((candidate, index) => (
          <PickCard
            key={candidate.movieId}
            candidate={candidate}
            index={index}
            neighbour={picks[index + 1]}
            onCommit={handleCommit}
          />
        ))}

        {!isColdStart && picks.length > 0 && (
          <button
            type="button"
            onClick={rejectAll}
            disabled={isRefilling}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            {isRefilling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            None of these
          </button>
        )}

        {!isColdStart && !error && picks.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-12 font-mono">
            Nothing queued. That's a choice.
          </p>
        )}
      </div>

      <AttributionNotice />
    </div>
  );
}
