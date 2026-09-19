import { useCallback, useMemo, useRef, useState } from 'react';
import { Camera, ClipboardPaste, Eye, Bookmark, Loader2, Undo2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLibraryImport } from '../hooks/useLibraryImport';
import { extractFromImages, extractFromText } from '../lib/import/paste/extract';
import { bucketFor, bundleFromList, type ListIntent, type ParsedList } from '../lib/import/paste/heuristics';
import { undoImport, type CreatedRefs } from '../lib/import/write';

type Bucket = 'watched' | 'watchlist';
type Mode = 'paste' | 'screenshot';

const UNDO_MS = 8000;

function itemKey(title: string, year?: string) {
  return `${title.toLowerCase()}|${year ?? ''}`;
}

/**
 * Paste a list or drop screenshots. Heuristics guess the bucket, the user flips one chip
 * or answers two buttons, and struck items always land in watched. Commit is immediate
 * with an eight second undo.
 */
export default function PasteListPanel({ mode, onDone }: { mode: Mode; onDone?: (count: number) => void }) {
  const { user } = useAuth();
  const { importBundle, isImporting, progress, label } = useLibraryImport();
  const imageInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [reading, setReading] = useState(false);
  const [parsed, setParsed] = useState<ParsedList | null>(null);
  const [intent, setIntent] = useState<ListIntent>('unknown');
  const [overrides, setOverrides] = useState<Map<string, Bucket>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ created: CreatedRefs; count: number } | null>(null);
  const undoTimer = useRef<number | null>(null);

  const readText = useCallback(async (value: string) => {
    if (!value.trim()) return;
    setReading(true);
    setError(null);
    try {
      const result = await extractFromText(value);
      if (!result.items.length) {
        setError('No film titles found in that text.');
        return;
      }
      setParsed(result);
      setIntent(result.confidence >= 0.6 ? result.intent : 'unknown');
      setOverrides(new Map());
    } finally {
      setReading(false);
    }
  }, []);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const clip = await navigator.clipboard.readText();
      setText(clip);
      await readText(clip);
    } catch {
      setError('Clipboard blocked. Paste into the box instead.');
    }
  }, [readText]);

  const readImages = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setReading(true);
    setError(null);
    try {
      const result = await extractFromImages(Array.from(files));
      if (!result || !result.items.length) {
        setError('Could not read films from that screenshot.');
        return;
      }
      setParsed(result);
      setIntent(result.confidence >= 0.6 ? result.intent : 'unknown');
      setOverrides(new Map());
    } finally {
      setReading(false);
    }
  }, []);

  const buckets = useMemo(() => {
    if (!parsed) return { watched: 0, watchlist: 0 };
    let watched = 0;
    let watchlist = 0;
    for (const item of parsed.items) {
      const b = overrides.get(itemKey(item.title, item.year)) ?? bucketFor(item, intent === 'unknown' ? 'watched' : intent);
      if (b === 'watched') watched++;
      else watchlist++;
    }
    return { watched, watchlist };
  }, [parsed, intent, overrides]);

  const commit = useCallback(
    async (chosen: ListIntent) => {
      if (!parsed || !user) return;
      const bundle = bundleFromList(parsed.items, chosen, mode, overrides);
      const result = await importBundle(bundle);
      if (!result) return;
      const count = result.films + result.watchlist;
      setUndo({ created: result.created, count });
      setParsed(null);
      setText('');
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
      undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS);
      onDone?.(count);
    },
    [parsed, user, mode, overrides, importBundle, onDone],
  );

  const runUndo = useCallback(async () => {
    if (!undo || !user) return;
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    const refs = undo.created;
    setUndo(null);
    await undoImport(user.uid, refs);
  }, [undo, user]);

  const flip = () => setIntent((i) => (i === 'watchlist' ? 'watched' : 'watchlist'));

  const toggleItem = (key: string, current: Bucket) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(key, current === 'watched' ? 'watchlist' : 'watched');
      return next;
    });
  };

  if (isImporting) {
    return (
      <div className="py-6 text-center" data-testid="paste-progress">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-fg-2" />
        <p className="font-spec text-[10px] uppercase tracking-widest text-fg-2">{label}</p>
        {progress.total > 0 && (
          <p className="text-xs text-fg-3 mt-1">
            {progress.done} of {progress.total}
          </p>
        )}
      </div>
    );
  }

  if (undo) {
    return (
      <div className="py-4 space-y-3 text-center" data-testid="paste-done">
        <p className="font-spec text-[10px] uppercase tracking-widest text-fg">Added {undo.count} films</p>
        <button
          type="button"
          onClick={runUndo}
          data-testid="paste-undo"
          className="min-h-11 px-4 border border-line text-fg text-sm inline-flex items-center gap-2"
        >
          <Undo2 size={14} /> Undo
        </button>
      </div>
    );
  }

  if (parsed) {
    const effective: ListIntent = intent === 'unknown' ? 'watched' : intent;
    return (
      <div className="space-y-3" data-testid="paste-preview">
        {intent === 'unknown' ? (
          <div className="space-y-2">
            <p className="text-xs text-fg-2 text-center">{parsed.items.length} films. Which are these?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="paste-intent-watched"
                onClick={() => setIntent('watched')}
                className="min-h-14 border border-line bg-base-2 text-fg text-sm font-semibold flex flex-col items-center justify-center gap-1"
              >
                <Eye size={16} /> I have seen these
              </button>
              <button
                type="button"
                data-testid="paste-intent-watchlist"
                onClick={() => setIntent('watchlist')}
                className="min-h-14 border border-line bg-base-2 text-fg text-sm font-semibold flex flex-col items-center justify-center gap-1"
              >
                <Bookmark size={16} /> I want to see these
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={flip}
            data-testid="paste-intent-chip"
            className="w-full min-h-11 px-3 border border-fg bg-base-3 text-fg text-xs font-semibold flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              {intent === 'watchlist' ? <Bookmark size={14} /> : <Eye size={14} />}
              {intent === 'watchlist' ? `Want to watch · ${buckets.watchlist}` : `Watched · ${buckets.watched}`}
              {intent === 'watchlist' && buckets.watched > 0 ? ` · ${buckets.watched} already seen` : ''}
            </span>
            <span className="font-spec text-[10px] uppercase tracking-widest text-fg-3">Tap to flip</span>
          </button>
        )}

        <ul className="max-h-56 overflow-y-auto divide-y divide-line border border-line" data-testid="paste-items">
          {parsed.items.map((item) => {
            const key = itemKey(item.title, item.year);
            const bucket = overrides.get(key) ?? bucketFor(item, effective);
            return (
              <li key={key} className="flex items-center gap-2 px-3 min-h-11">
                <span className={`flex-1 text-sm truncate ${item.struck ? 'line-through text-fg-3' : 'text-fg'}`}>
                  {item.title}
                  {item.year ? <span className="text-fg-3"> {item.year}</span> : null}
                  {item.stars != null ? <span className="text-fg-3"> · {item.stars}★</span> : null}
                </span>
                <button
                  type="button"
                  onClick={() => toggleItem(key, bucket)}
                  aria-label={bucket === 'watched' ? 'Seen. Tap for want to watch' : 'Want to watch. Tap for seen'}
                  className={`min-h-8 px-2 font-spec text-[10px] uppercase tracking-widest border ${
                    bucket === 'watched' ? 'border-fg text-fg' : 'border-line text-fg-3'
                  }`}
                >
                  {bucket === 'watched' ? 'Seen' : 'Want'}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex gap-2">
          <button type="button" onClick={() => setParsed(null)} className="min-h-11 px-3 border border-line text-fg-2 text-sm">
            Back
          </button>
          <button
            type="button"
            disabled={intent === 'unknown'}
            onClick={() => commit(intent)}
            data-testid="paste-commit"
            className="flex-1 min-h-11 bg-fg text-base text-sm font-semibold disabled:opacity-40"
          >
            Add {parsed.items.length} films
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid={`paste-panel-${mode}`}>
      {mode === 'paste' ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Paste a list. One film per line.\nStrikethrough or [x] means you have seen it.'}
            rows={6}
            aria-label="Pasted list"
            data-testid="paste-textarea"
            className="w-full bg-base-2 border border-line px-3 py-2 text-sm text-fg placeholder-fg-3 outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={pasteFromClipboard}
              className="min-h-11 px-3 border border-line text-fg text-sm flex items-center gap-2"
            >
              <ClipboardPaste size={14} /> Paste
            </button>
            <button
              type="button"
              onClick={() => readText(text)}
              disabled={!text.trim() || reading}
              data-testid="paste-read"
              className="flex-1 min-h-11 bg-fg text-base text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {reading ? <Loader2 size={14} className="animate-spin" /> : null}
              Read the list
            </button>
          </div>
        </>
      ) : (
        <>
          <input
            ref={imageInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            data-testid="screenshot-input"
            onChange={(e) => {
              void readImages(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => imageInput.current?.click()}
            disabled={reading}
            className="w-full min-h-20 border border-dashed border-line bg-base-2 text-fg text-sm flex flex-col items-center justify-center gap-2 disabled:opacity-50"
          >
            {reading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            {reading ? 'Reading the screenshot' : 'Choose screenshots'}
          </button>
          <p className="text-[10px] text-fg-3">Letterboxd, Notes, Reminders, IMDb, anything with film titles. Up to four images.</p>
        </>
      )}
      {error && (
        <p className="text-xs text-red-400" data-testid="paste-error">
          {error}
        </p>
      )}
    </div>
  );
}
