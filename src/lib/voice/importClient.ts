export type VoiceLike = {
  title: string;
  year: string;
  tmdbId: number | null;
  reason: string;
  posterPath: string | null;
};

export type VoicePick = {
  title: string;
  year: string;
  tmdbId: number | null;
  posterPath: string | null;
};

export type VoiceLookup =
  | { found: false; phone: string }
  | { found: true; phone: string; alreadyImported: true }
  | { found: true; phone: string; alreadyImported: false; likes: VoiceLike[]; picks: VoicePick[] };

async function post(body: Record<string, unknown>): Promise<VoiceLookup & { claimed?: boolean; error?: string }> {
  const res = await fetch('/api/voice/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as VoiceLookup & { error?: string; claimed?: boolean };
  if (!res.ok) throw new Error(data.error || 'Could not check that number.');
  return data;
}

export function lookupVoicePhone(phone: string, idToken: string): Promise<VoiceLookup> {
  return post({ phone, idToken });
}

export async function confirmVoicePhone(phone: string, idToken: string): Promise<void> {
  await post({ phone, idToken, confirm: true });
}
