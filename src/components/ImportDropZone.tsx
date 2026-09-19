import { useCallback, useRef, useState } from 'react';
import { FolderOpen, Loader2, Upload } from 'lucide-react';
import { useLibraryImport } from '../hooks/useLibraryImport';

type Props = {
  onDone?: (count: number) => void;
  compact?: boolean;
  testId?: string;
};

/**
 * Accepts a Letterboxd export zip, its unzipped folder, loose CSVs, or an IMDb ratings.csv.
 * Detection is by CSV header, never by filename.
 */
export default function ImportDropZone({ onDone, compact = false, testId = 'import-dropzone' }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const { phase, label, progress, summary, unresolved, error, isImporting, importFiles } = useLibraryImport();

  const handleFiles = useCallback(
    async (list: FileList | File[] | null) => {
      if (!list || !list.length) return;
      const result = await importFiles(Array.from(list));
      if (result) onDone?.(result.films + result.nights + result.watchlist);
    },
    [importFiles, onDone],
  );

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setOver(false);
      const items = Array.from(e.dataTransfer.items ?? []);
      const files: File[] = [];
      const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
        if (entry.isFile) {
          await new Promise<void>((resolve) =>
            (entry as FileSystemFileEntry).file((file) => {
              Object.defineProperty(file, 'webkitRelativePath', { value: `${prefix}${file.name}` });
              files.push(file);
              resolve();
            }, () => resolve()),
          );
        } else if (entry.isDirectory) {
          const reader = (entry as FileSystemDirectoryEntry).createReader();
          const children: FileSystemEntry[] = [];
          for (;;) {
            const batch = await new Promise<FileSystemEntry[]>((resolve) =>
              reader.readEntries(resolve, () => resolve([])),
            );
            if (!batch.length) break;
            children.push(...batch);
          }
          for (const child of children) await walk(child, `${prefix}${entry.name}/`);
        }
      };
      const entries = items.map((item) => (typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null));
      if (entries.some((entry) => entry != null)) {
        for (const entry of entries) if (entry) await walk(entry, '');
      } else {
        files.push(...Array.from(e.dataTransfer.files));
      }
      await handleFiles(files);
    },
    [handleFiles],
  );

  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div data-testid={testId} className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`border border-dashed p-4 text-center transition-colors ${over ? 'border-fg bg-base-3' : 'border-line bg-base-2'}`}
        data-testid={`${testId}-target`}
      >
        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".zip,.csv,application/zip,text/csv"
          className="hidden"
          data-testid={`${testId}-input`}
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={folderInput}
          type="file"
          multiple
          className="hidden"
          data-testid={`${testId}-folder`}
          // @ts-expect-error webkitdirectory is a non-standard attribute React does not type.
          webkitdirectory=""
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        {isImporting ? (
          <div className="py-3" data-testid={`${testId}-progress`}>
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-fg-2" />
            <p className="font-spec text-[10px] uppercase tracking-widest text-fg-2">{label}</p>
            {progress.total > 0 && (
              <p className="text-xs text-fg-3 mt-1">
                {progress.done} of {progress.total} · {percent}%
              </p>
            )}
          </div>
        ) : phase === 'done' && summary ? (
          <div className="py-2" data-testid={`${testId}-done`}>
            <p className="font-spec text-[10px] uppercase tracking-widest text-fg">Done</p>
            <p className="text-xs text-fg-2 mt-1">
              {summary.films} films · {summary.nights} nights · {summary.watchlist} to watch
            </p>
            {unresolved.length > 0 && (
              <p className="text-[10px] text-fg-3 mt-1" data-testid={`${testId}-unresolved`}>
                {unresolved.length} could not be matched
              </p>
            )}
          </div>
        ) : (
          <>
            <Upload className={`mx-auto mb-2 text-fg-2 ${compact ? 'w-5 h-5' : 'w-8 h-8'}`} />
            <p className="text-sm font-medium text-fg">Drop your export</p>
            <p className="text-xs text-fg-3 mt-1">Letterboxd zip or folder. IMDb ratings.csv works too.</p>
            <div className="flex gap-2 justify-center mt-3">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="min-h-11 px-3 bg-fg text-base text-xs font-semibold"
                data-testid={`${testId}-pick`}
              >
                Choose zip or CSV
              </button>
              <button
                type="button"
                onClick={() => folderInput.current?.click()}
                className="min-h-11 px-3 border border-line text-fg text-xs font-semibold flex items-center gap-1.5"
              >
                <FolderOpen size={14} />
                Folder
              </button>
            </div>
          </>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-400" data-testid={`${testId}-error`}>
          {error}
        </p>
      )}
      {!compact && phase === 'idle' && (
        <p className="text-[10px] text-fg-3 leading-relaxed">
          Letterboxd: Settings, Import &amp; Export, Export Your Data. IMDb: your Ratings page, three dots, Export.
        </p>
      )}
    </div>
  );
}
