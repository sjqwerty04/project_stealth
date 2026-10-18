#!/usr/bin/env node
// Idempotently ensures the one shared test account exists, is whitelisted, and has a profile.
// Uses the public Firebase web API key and the account's own ID token, so it runs under
// firestore.rules like the app does. No service account required.
//
//   SELECTS_TEST_EMAIL=... SELECTS_TEST_PASSWORD=... npm run seed:test-account
//   VITE_FIREBASE_EMULATOR=1 ... npm run seed:test-account   # local emulator instead of mvplockedin

const API_KEY = 'AIzaSyADZLBw2WEMYKpr9d_NKO1aEncT-tGX8PU';
const PROJECT_ID = 'mvplockedin';
const emulator = process.env.VITE_FIREBASE_EMULATOR === '1';

const AUTH_BASE = emulator
  ? 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1'
  : 'https://identitytoolkit.googleapis.com/v1';
const DOCS_BASE = `${emulator ? 'http://127.0.0.1:8080' : 'https://firestore.googleapis.com'}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function fail(code, message) {
  console.error(`seed-test-account: ${message}`);
  process.exit(code);
}

const email = process.env.SELECTS_TEST_EMAIL?.trim().toLowerCase();
const password = process.env.SELECTS_TEST_PASSWORD;
if (!email || !password) {
  fail(2, 'blocked. Set SELECTS_TEST_EMAIL and SELECTS_TEST_PASSWORD (Cursor Dashboard > Cloud Agents > Secrets).');
}

async function authCall(method, body) {
  const res = await fetch(`${AUTH_BASE}/accounts:${method}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, returnSecureToken: true }),
  });
  const data = await res.json();
  return res.ok ? { ok: true, data } : { ok: false, error: data.error?.message ?? String(res.status) };
}

async function docCall(path, idToken, init = {}) {
  return fetch(`${DOCS_BASE}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json', ...init.headers },
  });
}

async function ensureDoc(collection, id, fields, idToken) {
  const existing = await docCall(`${collection}/${encodeURIComponent(id)}`, idToken);
  if (existing.ok) return 'exists';
  if (existing.status !== 404) fail(1, `read ${collection}/${id} failed: ${existing.status} ${await existing.text()}`);
  const created = await docCall(`${collection}?documentId=${encodeURIComponent(id)}`, idToken, {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });
  if (!created.ok) fail(1, `create ${collection}/${id} failed: ${created.status} ${await created.text()}`);
  return 'created';
}

let account = 'signed-in';
let session = await authCall('signInWithPassword', { email, password });
if (!session.ok) {
  const signUp = await authCall('signUp', { email, password });
  if (!signUp.ok) {
    if (signUp.error === 'EMAIL_EXISTS') {
      fail(1, `${email} exists but SELECTS_TEST_PASSWORD does not match it. Fix the secret; do not make a new account.`);
    }
    fail(1, `sign-up failed: ${signUp.error} (sign-in said ${session.error})`);
  }
  session = signUp;
  account = 'created';
}

const { localId: uid, idToken } = session.data;
const whitelist = await ensureDoc('whitelist', email, { allowed: { booleanValue: true } }, idToken);
const profile = await ensureDoc(
  'users',
  uid,
  {
    profile: {
      mapValue: {
        fields: {
          displayName: { stringValue: email.split('@')[0] },
          email: { stringValue: email },
          joinDate: { timestampValue: new Date().toISOString() },
          profileImage: { stringValue: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}` },
          handle: { nullValue: null },
          handleLower: { nullValue: null },
        },
      },
    },
  },
  idToken,
);

console.log(JSON.stringify({ target: emulator ? 'emulator' : PROJECT_ID, email, uid, account, whitelist, profile }, null, 2));
