const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyADZLBw2WEMYKpr9d_NKO1aEncT-tGX8PU';

export async function userIdFromToken(idToken: string): Promise<string | null> {
  if (!idToken) return null;
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { users?: { localId?: string }[] };
  return data.users?.[0]?.localId ?? null;
}
