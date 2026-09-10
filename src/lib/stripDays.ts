import { format } from 'date-fns';

export type LocalDateKey = string & { readonly __brand: 'LocalDateKey' };

export type EmptyDay = {
  readonly occupancy: 'empty';
  readonly key: LocalDateKey;
  readonly date: Date;
};

export type OccupiedDay<T> = {
  readonly occupancy: 'occupied';
  readonly key: LocalDateKey;
  readonly date: Date;
  readonly events: readonly [T, ...T[]];
};

export type CalendarDay<T> = EmptyDay | OccupiedDay<T>;

export function localDateKey(date: Date): LocalDateKey {
  return format(date, 'yyyy-MM-dd') as LocalDateKey;
}

export function parseLocalDateKey(raw: string): LocalDateKey | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw as LocalDateKey;
}

export function discoverSearchPath(key: LocalDateKey): `/discover?date=${string}` {
  return `/discover?date=${key}`;
}

export function occupyDay<T>(
  date: Date,
  eventsByDay: ReadonlyMap<string, readonly T[]>,
): CalendarDay<T> {
  const key = localDateKey(date);
  const events = eventsByDay.get(key) ?? [];
  const first = events[0];
  if (first === undefined) {
    return { occupancy: 'empty', key, date };
  }
  return { occupancy: 'occupied', key, date, events: [first, ...events.slice(1)] };
}

export function eventDayKey(date: unknown): string {
  if (date && typeof date === 'object') {
    const withToDate = date as { toDate?: () => Date };
    if (typeof withToDate.toDate === 'function') {
      const d = withToDate.toDate();
      if (!Number.isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
    }
    const withSeconds = date as { seconds?: number };
    if (typeof withSeconds.seconds === 'number') {
      return format(new Date(withSeconds.seconds * 1000), 'yyyy-MM-dd');
    }
  }
  if (typeof date === 'number' && Number.isFinite(date)) {
    return format(new Date(date), 'yyyy-MM-dd');
  }
  if (typeof date !== 'string' || !date) return '';
  const iso = date.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const parsed = new Date(date);
  if (!Number.isNaN(parsed.getTime())) return format(parsed, 'yyyy-MM-dd');
  return '';
}

function parseHex(color: string): { r: number; g: number; b: number } | null {
  const raw = color.trim();
  const short = /^#([0-9a-fA-F]{3})$/.exec(raw);
  if (short) {
    const [r, g, b] = short[1].split('').map((c) => parseInt(c + c, 16));
    return { r, g, b };
  }
  const long = /^#([0-9a-fA-F]{6})$/.exec(raw);
  if (long) {
    return {
      r: parseInt(long[1].slice(0, 2), 16),
      g: parseInt(long[1].slice(2, 4), 16),
      b: parseInt(long[1].slice(4, 6), 16),
    };
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(raw);
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }
  return null;
}

export function stripFill(accent: string | undefined, logged: boolean): string {
  if (!logged) return 'var(--line)';
  if (!accent) return 'var(--film)';
  const rgb = parseHex(accent);
  if (!rgb) return accent;
  const lum = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  if (lum < 0.18) return 'var(--film)';
  return accent;
}
