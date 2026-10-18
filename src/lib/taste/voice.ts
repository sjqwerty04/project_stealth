import { AXIS_PREFERENCE, type Axis, type TasteSnapshot } from './types';

const DASH = /[\u2013\u2014]/g;

const AXIS_LINE: Record<Axis, string> = {
  story: 'Story comes first.',
  visual: 'The image comes first.',
  mood: 'Mood comes first.',
};

export type TasteVoice = {
  lead: string;
  profileBody: string;
  importLine: string;
  retakeLine: string;
  keep: string[];
  leave: string[];
  recent: string[];
  axis: Axis | null;
  empty: boolean;
};

function clean(value: string): string {
  return value.replace(DASH, ',').replace(/\s+/g, ' ').trim();
}

function list(names: string[]): string {
  const items = names.map((name) => name.trim()).filter(Boolean);
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function filmPrefs(preferences: string[]): string[] {
  const axis = new Set(Object.values(AXIS_PREFERENCE).map((line) => line.toLowerCase()));
  const out: string[] = [];
  for (const raw of preferences) {
    const pref = raw.trim();
    const lower = pref.toLowerCase();
    if (!pref) continue;
    if (lower.startsWith('dislikes:')) continue;
    if (lower.startsWith('something like ')) continue;
    if (lower.startsWith('curious about ')) continue;
    if (lower.startsWith('often tags ')) continue;
    if (axis.has(lower)) continue;
    if (out.some((item) => item.toLowerCase() === lower)) continue;
    out.push(pref);
  }
  return out;
}

function dislikes(preferences: string[]): string[] {
  const out: string[] = [];
  for (const raw of preferences) {
    const match = raw.trim().match(/^dislikes:\s*(.+)$/i);
    const title = match?.[1]?.trim();
    if (!title) continue;
    if (out.some((item) => item.toLowerCase() === title.toLowerCase())) continue;
    out.push(title);
  }
  return out;
}

export function tasteVoice(snapshot: TasteSnapshot): TasteVoice {
  const keep = filmPrefs(snapshot.context.preferences).slice(0, 4);
  const leave = dislikes(snapshot.context.preferences).slice(0, 4);
  const recent = snapshot.context.history
    .map((row) => row.item.trim())
    .filter((title) => title && !leave.some((item) => item.toLowerCase() === title.toLowerCase()))
    .filter((title, index, all) => all.findIndex((item) => item.toLowerCase() === title.toLowerCase()) === index)
    .slice(0, 3);
  const axis = snapshot.identity.axis;
  const persona = clean(snapshot.identity.personaLine || snapshot.context.profile || '');
  const axisLine = axis ? AXIS_LINE[axis] : '';
  const lead = clean(
    persona || axisLine || (recent[0] ? `${recent[0]} is the latest mark.` : 'No marks in this taste yet.'),
  );
  const profileParts = [
    keep.length ? `Keeping ${list(keep.slice(0, 3))}.` : '',
    leave.length ? `Leaving ${list(leave.slice(0, 3))}.` : '',
  ].filter(Boolean);
  if (!profileParts.length && recent.length) profileParts.push(`Recent marks: ${list(recent)}.`);
  const profileBody = clean(profileParts.join(' ') || lead);
  const importLine = clean(
    keep[0]
      ? `New history should sit with ${keep[0]}.`
      : leave[0]
        ? `New history should not look like ${leave[0]}.`
        : 'New history becomes the first mark.',
  );
  const empty = !persona && !axis && keep.length === 0 && leave.length === 0 && recent.length === 0;
  return {
    lead,
    profileBody,
    importLine,
    retakeLine: empty ? 'Set the marks' : 'Retake the marks',
    keep,
    leave,
    recent,
    axis,
    empty,
  };
}
