export type MentionEntity =
  | { kind: 'film'; id: number; name: string; year?: string; image: string | null }
  | { kind: 'person'; id: number; name: string; image: string | null };

export type Segment = { text: string } | { text: string; entity: MentionEntity };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Splits text so every entity name becomes its own segment. The longest name wins
 * when names overlap ("Dune: Part Two" over "Dune"), and each entity is matched
 * once per text so a repeated title does not sprout a poster every time.
 */
export function splitMentions(text: string, entities: MentionEntity[]): Segment[] {
  const usable = entities.filter((e) => e.name.trim().length > 1);
  if (!usable.length || !text) return [{ text }];
  const sorted = [...usable].sort((a, b) => b.name.length - a.name.length);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${sorted.map((e) => escape(e.name)).join('|')})(?![\\p{L}\\p{N}])`, 'giu');

  const out: Segment[] = [];
  const used = new Set<string>();
  let last = 0;
  for (const m of text.matchAll(re)) {
    const entity = sorted.find((e) => e.name.toLowerCase() === m[0].toLowerCase());
    if (!entity) continue;
    const key = `${entity.kind}-${entity.id}`;
    if (used.has(key)) continue;
    used.add(key);
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], entity });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** Entities the text never names, so they can still be shown beside the answer. */
export function unmentioned(text: string, entities: MentionEntity[]) {
  const named = new Set(
    splitMentions(text, entities).flatMap((s) => ('entity' in s ? [`${s.entity.kind}-${s.entity.id}`] : [])),
  );
  return entities.filter((e) => !named.has(`${e.kind}-${e.id}`));
}
