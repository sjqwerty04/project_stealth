export type SelectPick = {
  title: string;
  year: string;
  whyMatch: string;
  confidence: number;
  id?: string;
};

type SelectRec = {
  item?: { name?: string; title?: string; year?: string | number; id?: string };
  name?: string;
  title?: string;
  year?: string | number;
  confidence?: number;
  score?: number;
  match_score?: number;
  explanation?: { why_match?: string };
  why_match?: string;
  whyMatch?: string;
};

export function generatedDiaryFields(generated: {
  updatedAt: number | null;
  fromEventId: string | null;
  compactForChat: string;
  patterns: string[];
  insightCards: string[];
}) {
  return {
    'generated.updatedAt': generated.updatedAt,
    'generated.fromEventId': generated.fromEventId,
    'generated.compactForChat': generated.compactForChat,
    'generated.patterns': generated.patterns,
    'generated.insightCards': generated.insightCards,
  };
}

export function parseSelectPicks(raw: unknown): SelectPick[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { recommendations?: unknown }).recommendations)
      ? (raw as { recommendations: unknown[] }).recommendations
      : raw && typeof raw === 'object' && Array.isArray((raw as { picks?: unknown }).picks)
        ? (raw as { picks: unknown[] }).picks
        : [];

  return list
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const rec = row as SelectRec;
      const title = rec.item?.name || rec.item?.title || rec.name || rec.title || '';
      if (!title) return null;
      const yearSource = rec.item?.year ?? rec.year ?? '';
      const confidence = rec.confidence ?? rec.score ?? rec.match_score ?? 1;
      const whyMatch = rec.explanation?.why_match || rec.why_match || rec.whyMatch || '';
      const pick: SelectPick = {
        title,
        year: String(yearSource),
        whyMatch,
        confidence: typeof confidence === 'number' ? confidence : 1,
      };
      if (rec.item?.id) pick.id = rec.item.id;
      return pick;
    })
    .filter((row): row is SelectPick => row != null);
}
