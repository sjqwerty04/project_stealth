import pg from 'pg';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS callers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  imported_to_user_id text,
  imported_at timestamptz
);
CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL REFERENCES callers(id),
  xai_call_id text UNIQUE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  sms_opt_in boolean
);
CREATE TABLE IF NOT EXISTS mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES calls(id),
  caller_id uuid NOT NULL REFERENCES callers(id),
  title text NOT NULL,
  year text,
  tmdb_id integer,
  liked boolean,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES calls(id),
  caller_id uuid NOT NULL REFERENCES callers(id),
  title text NOT NULL,
  year text,
  tmdb_id integer,
  reaction text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS final_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES calls(id),
  caller_id uuid NOT NULL REFERENCES callers(id),
  title text NOT NULL,
  year text,
  tmdb_id integer,
  poster_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS campaign_members (
  campaign_id uuid NOT NULL REFERENCES campaigns(id),
  caller_id uuid NOT NULL REFERENCES callers(id),
  opted_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, caller_id)
);
`;

let schemaReady = false;

export function databaseUrl(): string | null {
  const url = process.env.VOICE_DATABASE_URL?.trim();
  return url || null;
}

export function databaseConfigured(): boolean {
  return Boolean(databaseUrl());
}

function sslFor(url: string): pg.ClientConfig['ssl'] {
  if (/neon\.tech|sslmode=require/i.test(url)) return { rejectUnauthorized: false };
  return undefined;
}

export async function withVoiceDb<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const url = databaseUrl();
  if (!url) throw new Error('VOICE_DATABASE_URL is not set');
  const client = new pg.Client({ connectionString: url, ssl: sslFor(url) });
  await client.connect();
  try {
    if (!schemaReady) {
      await client.query(SCHEMA);
      schemaReady = true;
    }
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Test helper. Production uses the once-per-process flag. */
export function resetSchemaFlag() {
  schemaReady = false;
}
