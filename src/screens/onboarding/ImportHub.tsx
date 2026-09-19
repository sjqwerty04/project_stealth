import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ImportDropZone from '../../components/ImportDropZone';
import PasteListPanel from '../../components/PasteListPanel';
import { Button, Input } from '../../components/ui';
import { useLetterboxdImport } from '../../hooks/useLetterboxdImport';
import type { WriteSummary } from '../../lib/import/write';
import {
  IMPORT_SOURCES,
  type ImportSourceId,
  type ImportSourceState,
  type OnboardingAction,
  type OnboardingState,
} from '../../lib/onboarding/state';

type Props = {
  imports: OnboardingState['imports'];
  dispatch: (action: OnboardingAction) => void;
};

const TILE_COPY: Record<ImportSourceId, { title: string; sub: string }> = {
  letterboxd: { title: 'Letterboxd', sub: 'Username or export zip' },
  imdb: { title: 'IMDb', sub: 'ratings.csv export' },
  notes: { title: 'Notes', sub: 'Paste a list from your Notes' },
  images: { title: 'Images', sub: 'Ticket stubs · Screenshots · Photos' },
};

const EXPAND = { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const };

function totalFilms(imports: OnboardingState['imports']): number {
  return Object.values(imports).reduce((n, s) => (s.status === 'done' ? n + s.films : n), 0);
}

function TileStatus({ state }: { state: ImportSourceState }) {
  switch (state.status) {
    case 'running':
      return (
        <span className="font-spec text-[10px] uppercase tracking-widest text-fg-2 animate-pulse" aria-live="polite">
          Reading
        </span>
      );
    case 'done':
      return (
        <span className="font-spec text-[10px] uppercase tracking-widest text-select" aria-live="polite">
          {state.films} films
        </span>
      );
    case 'error':
      return (
        <span className="font-spec text-[10px] uppercase tracking-widest text-fg-2 truncate max-w-[10rem]" title={state.message}>
          {state.message}
        </span>
      );
    default:
      return null;
  }
}

function LetterboxdUsername({ dispatch }: { dispatch: Props['dispatch'] }) {
  const [username, setUsername] = useState('');
  const [attempt, setAttempt] = useState(0);
  const failedRef = useRef(false);
  const { importFromLetterboxd, isImporting, error } = useLetterboxdImport();

  // The hook sets its error right before returning 0, so the message is only current after a re-render.
  useEffect(() => {
    if (!failedRef.current) return;
    failedRef.current = false;
    dispatch({ type: 'importFailed', source: 'letterboxd', message: error ?? 'Could not read that Letterboxd.' });
  }, [attempt, error, dispatch]);

  const run = async () => {
    const clean = username.replace(/^.*letterboxd\.com\//i, '').replace(/\/.*$/, '').trim();
    if (!clean || isImporting) return;
    dispatch({ type: 'importStarted', source: 'letterboxd' });
    const count = await importFromLetterboxd(clean);
    if (count > 0) {
      dispatch({ type: 'importDone', source: 'letterboxd', films: count, nights: 0 });
    } else {
      failedRef.current = true;
      setAttempt((n) => n + 1);
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor="import-letterboxd-username" className="font-spec text-[10px] uppercase tracking-widest text-fg-3">
        Username
      </label>
      <div className="flex gap-2">
        <Input
          id="import-letterboxd-username"
          data-testid="import-letterboxd-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="letterboxd username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void run();
          }}
          className="flex-1 font-spec text-xs"
        />
      </div>
      <Button
        type="button"
        data-testid="import-letterboxd-read"
        onClick={() => void run()}
        disabled={!username.trim()}
        loading={isImporting}
        className="w-full"
      >
        Read my Letterboxd
      </Button>
      <p className="text-[10px] text-fg-3 leading-relaxed">The public feed carries your last fifty. Drop the export for everything.</p>
    </div>
  );
}

export default function ImportHub({ imports, dispatch }: Props) {
  const [open, setOpen] = useState<ImportSourceId | null>(null);

  const toggle = (id: ImportSourceId) => setOpen((cur) => (cur === id ? null : id));

  const handlers = useCallback(
    (source: ImportSourceId) => ({
      onStart: () => dispatch({ type: 'importStarted', source }),
      onResult: (summary: WriteSummary) => dispatch({ type: 'importDone', source, films: summary.films, nights: summary.nights }),
      onError: (message: string) => dispatch({ type: 'importFailed', source, message }),
    }),
    [dispatch],
  );

  const renderBody = (id: ImportSourceId) => {
    const h = handlers(id);
    switch (id) {
      case 'letterboxd':
        return (
          <div className="space-y-4">
            <LetterboxdUsername dispatch={dispatch} />
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="font-spec text-[10px] uppercase tracking-widest text-fg-3">or the export</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <ImportDropZone compact testId="import-letterboxd-drop" {...h} />
          </div>
        );
      case 'imdb':
        return <ImportDropZone compact testId="import-imdb-drop" {...h} />;
      case 'notes':
        return <PasteListPanel mode="paste" {...h} />;
      case 'images':
        return <PasteListPanel mode="screenshot" {...h} />;
    }
  };

  const total = totalFilms(imports);

  return (
    <section data-testid="import-hub" className="w-full space-y-6 text-fg">
      <header className="space-y-3">
        <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3">Optional · Strongly recommended</p>
        <h1 className="font-display text-2xl leading-tight text-fg">I can read your last fifty in four seconds.</h1>
        <p className="text-sm text-fg-2 leading-relaxed">
          Your username is enough. Everything you have already logged becomes the floor your recommendations start from, and the
          map fills in as you go.
        </p>
      </header>

      <ul className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2 list-none p-0 m-0">
        {IMPORT_SOURCES.map((id) => {
          const expanded = open === id;
          const copy = TILE_COPY[id];
          const bodyId = `import-tile-${id}-body`;
          return (
            <li key={id} className={`border border-line bg-base-2 ${expanded ? 'min-[400px]:col-span-2' : ''}`}>
              <button
                type="button"
                data-testid={`import-tile-${id}`}
                aria-expanded={expanded}
                aria-controls={bodyId}
                onClick={() => toggle(id)}
                className="w-full min-h-16 px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-base-3 transition-colors"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-fg">{copy.title}</span>
                  <span className="block font-spec text-[10px] uppercase tracking-widest text-fg-3 mt-0.5">{copy.sub}</span>
                </span>
                <span className="shrink-0 flex items-center" data-testid={`import-tile-${id}-status`}>
                  <TileStatus state={imports[id]} />
                </span>
              </button>
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    key="body"
                    id={bodyId}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={EXPAND}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 border-t border-line">{renderBody(id)}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>

      <p data-testid="import-films-read" className="font-spec text-[10px] uppercase tracking-widest text-fg-3" aria-live="polite">
        Films read · <span className={total > 0 ? 'text-select' : 'text-fg-3'}>{total}</span>
      </p>
    </section>
  );
}
