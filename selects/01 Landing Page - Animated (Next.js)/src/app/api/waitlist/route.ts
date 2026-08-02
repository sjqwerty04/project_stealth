import { NextRequest } from "next/server";

// In-memory store for now — replace with Supabase when configured
const waitlist: Record<string, unknown>[] = [];

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    firstName,
    lastName,
    email,
    newsletterOptIn,
    personaName,
    personaColor,
    positiveAnchor,
    negativeAnchor,
    preferences,
    region,
  } = body;

  if (!email || !firstName) {
    return Response.json(
      { error: "Email and first name are required" },
      { status: 400 }
    );
  }

  const entry = {
    id: crypto.randomUUID(),
    firstName,
    lastName,
    email,
    newsletterOptIn: newsletterOptIn || false,
    personaName,
    personaColor,
    positiveAnchor,
    negativeAnchor,
    preferences,
    region,
    createdAt: new Date().toISOString(),
  };

  waitlist.push(entry);
  console.log(`[Waitlist] New signup: ${email} — ${personaName}`);

  // TODO: Replace with Supabase insert
  // const { data, error } = await supabase.from('users_waitlist').insert(entry);

  return Response.json({ success: true, id: entry.id });
}
