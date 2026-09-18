import Papa from 'papaparse';

export type CsvRow = Record<string, string>;

/** Header keys are trimmed and lowercased so "Letterboxd URI " and "Name" read the same everywhere. */
export function normalizeHeader(header: string): string {
  return header.replace(/^\uFEFF/, '').trim().toLowerCase();
}

export function parseCsv(text: string): { rows: CsvRow[]; headers: string[] } {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normalizeHeader,
    transform: (value) => (typeof value === 'string' ? value.trim() : value),
  });
  const headers = (result.meta.fields ?? []).map(normalizeHeader);
  const rows = result.data.filter((row) => Object.values(row).some((v) => v && v.length));
  return { rows, headers };
}

export function headersOf(text: string): string[] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const parsed = Papa.parse<string[]>(firstLine, { header: false });
  return (parsed.data[0] ?? []).map((h) => normalizeHeader(String(h)));
}
