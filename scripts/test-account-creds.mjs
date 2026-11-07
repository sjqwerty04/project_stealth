import fs from 'node:fs';

// Selects Project store on Cursor cloud agents; outside git by design.
const DEFAULT_CREDS_FILE = '/cursor/stores/bc-aa24adcb-569e-4a03-a7be-baf7bf9b3aa1/internal/test-account-creds.md';

/** Env first, then `SELECTS_TEST_*=` lines in the creds file. Returns null when neither is available. */
export function loadTestAccount() {
  let email = process.env.SELECTS_TEST_EMAIL;
  let password = process.env.SELECTS_TEST_PASSWORD;
  const file = process.env.SELECTS_TEST_CREDS_FILE || DEFAULT_CREDS_FILE;
  if ((!email || !password) && fs.existsSync(file)) {
    const text = fs.readFileSync(file, 'utf8');
    email ||= text.match(/^SELECTS_TEST_EMAIL=(.+)$/m)?.[1].trim();
    password ||= text.match(/^SELECTS_TEST_PASSWORD=(.+)$/m)?.[1].trim();
  }
  return email && password ? { email, password } : null;
}
