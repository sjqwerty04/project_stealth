import JSZip from 'jszip';

/** One CSV pulled out of whatever the user dropped. `path` keeps the folder so lists/ and likes/ survive. */
export type CsvEntry = { path: string; name: string; text: string };

const SKIP_DIRS = ['__macosx/'];

function relativePath(file: File): string {
  const withDir = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return (withDir && withDir.length ? withDir : file.name).replace(/\\/g, '/');
}

function basename(path: string): string {
  return path.split('/').pop() ?? path;
}

function shouldSkip(path: string): boolean {
  const lower = path.toLowerCase();
  return SKIP_DIRS.some((d) => lower.includes(d)) || basename(lower).startsWith('._');
}

export async function entriesFromZip(file: Blob, label = 'export.zip'): Promise<CsvEntry[]> {
  const zip = await JSZip.loadAsync(file);
  const out: CsvEntry[] = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || shouldSkip(path) || !path.toLowerCase().endsWith('.csv')) continue;
    const text = await entry.async('string');
    out.push({ path: `${label}/${path}`, name: basename(path), text });
  }
  return out;
}

/**
 * Accepts a zip, a folder pick (webkitdirectory), loose CSVs, or any mix.
 * Nested zips inside a folder are expanded once.
 */
export async function collectCsvEntries(files: File[]): Promise<CsvEntry[]> {
  const out: CsvEntry[] = [];
  for (const file of files) {
    const path = relativePath(file);
    if (shouldSkip(path)) continue;
    const lower = path.toLowerCase();
    if (lower.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
      out.push(...(await entriesFromZip(file, basename(path))));
    } else if (lower.endsWith('.csv') || file.type === 'text/csv') {
      out.push({ path, name: basename(path), text: await file.text() });
    }
  }
  return out;
}

/** Find an entry by basename, preferring the shallowest path and skipping tombstone folders. */
export function findEntry(entries: CsvEntry[], name: string, opts?: { under?: string; excludeDirs?: string[] }): CsvEntry | undefined {
  const lowerName = name.toLowerCase();
  const exclude = (opts?.excludeDirs ?? ['deleted', 'orphaned']).map((d) => `/${d}/`);
  const candidates = entries.filter((e) => {
    if (e.name.toLowerCase() !== lowerName) return false;
    const p = `/${e.path.toLowerCase()}`;
    if (exclude.some((d) => p.includes(d))) return false;
    if (opts?.under) return p.includes(`/${opts.under.toLowerCase()}/`);
    return !p.includes('/likes/') && !p.includes('/lists/');
  });
  candidates.sort((a, b) => a.path.split('/').length - b.path.split('/').length);
  return candidates[0];
}

export function entriesUnder(entries: CsvEntry[], dir: string): CsvEntry[] {
  const needle = `/${dir.toLowerCase()}/`;
  return entries.filter((e) => `/${e.path.toLowerCase()}`.includes(needle) && !`/${e.path.toLowerCase()}`.includes('/deleted/'));
}
