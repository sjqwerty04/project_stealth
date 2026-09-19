import { useState } from 'react';
import { Film, Loader2, X } from 'lucide-react';
import ImportDropZone from './ImportDropZone';
import PasteListPanel from './PasteListPanel';
import { useLetterboxdImport } from '../hooks/useLetterboxdImport';

export type ImportTab = 'drop' | 'paste' | 'screenshot' | 'username';

const TABS: Array<{ id: ImportTab; label: string }> = [
  { id: 'drop', label: 'Drop export' },
  { id: 'paste', label: 'Paste list' },
  { id: 'screenshot', label: 'Screenshot' },
  { id: 'username', label: 'Username' },
];

export default function ImportSheet({
  open,
  onClose,
  onImported,
  title = 'Bring your history',
  initialTab = 'drop',
}: {
  open: boolean;
  onClose: () => void;
  onImported?: (count: number) => void;
  title?: string;
  initialTab?: ImportTab;
}) {
  const [tab, setTab] = useState<ImportTab>(initialTab);
  const [username, setUsername] = useState('');
  const [rssDone, setRssDone] = useState<number | null>(null);
  const { importFromLetterboxd, isImporting, progress, error } = useLetterboxdImport();

  if (!open) return null;

  const runUsername = async () => {
    const clean = username.replace(/^.*letterboxd\.com\//i, '').replace(/\/.*$/, '').trim();
    if (!clean) return;
    const count = await importFromLetterboxd(clean);
    setRssDone(count);
    if (count > 0) onImported?.(count);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" data-testid="import-sheet">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !isImporting && onClose()} />
      <div className="relative z-10 w-full max-w-sm bg-base border border-line p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-base-3 flex items-center justify-center">
              <Film size={16} className="text-fg" />
            </div>
            <div>
              <h3 className="font-display text-fg">{title}</h3>
              <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3">Letterboxd, IMDb, a list, a screenshot</p>
            </div>
          </div>
          {!isImporting && (
            <button type="button" onClick={onClose} aria-label="Close" className="p-2 min-h-11 min-w-11 text-fg-3 hover:text-fg">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="flex gap-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              data-testid={`import-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`flex-1 min-h-11 px-1 font-spec text-[9px] uppercase tracking-wider border ${
                tab === t.id ? 'bg-fg text-base border-fg' : 'bg-base-2 text-fg-3 border-line'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'drop' && <ImportDropZone onDone={onImported} />}
        {tab === 'paste' && <PasteListPanel mode="paste" onDone={onImported} />}
        {tab === 'screenshot' && <PasteListPanel mode="screenshot" onDone={onImported} />}

        {tab === 'username' && (
          <div className="space-y-3">
            <p className="text-xs text-fg-3">The public feed only carries the last 50 diary entries. Drop the export for everything.</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Letterboxd username"
                aria-label="Letterboxd username"
                autoCapitalize="none"
                autoCorrect="off"
                onKeyDown={(e) => e.key === 'Enter' && runUsername()}
                className="flex-1 bg-base-2 border border-line px-3 py-2 text-sm text-fg placeholder-fg-3 outline-none min-h-11"
              />
              <button
                type="button"
                onClick={runUsername}
                disabled={isImporting || !username.trim()}
                className="px-4 min-h-11 bg-fg text-base text-sm font-medium flex items-center gap-2 disabled:opacity-40"
              >
                {isImporting ? <Loader2 size={14} className="animate-spin" /> : 'Import'}
              </button>
            </div>
            {isImporting && progress.total > 0 && (
              <p className="text-xs text-fg-3">
                {progress.current} of {progress.total}
              </p>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
            {rssDone != null && rssDone > 0 && <p className="text-xs text-green-400">Imported {rssDone} films</p>}
          </div>
        )}
      </div>
    </div>
  );
}
