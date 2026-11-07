# AGENTS.md

Architecture and repo map: `agent.md`. Skills: `.cursor/skills/`.

## Test account: use the shared one, never sign up

There is exactly one test login for Selects. Humans and agents all reuse it, so its diary, watchlist, and onboarding state carry over between sessions.

- Account: `selects.qa@example.com` on Firebase `mvplockedin` (already created and onboarded).
- Credentials: `SELECTS_TEST_EMAIL` and `SELECTS_TEST_PASSWORD`. If those env vars are unset, `scripts/test-account-creds.mjs` reads them from the Selects Project store at `/cursor/stores/bc-aa24adcb-569e-4a03-a7be-baf7bf9b3aa1/internal/test-account-creds.md` (override with `SELECTS_TEST_CREDS_FILE`). That store is outside git. To export them into a shell: `set -a; source <(grep '^SELECTS_TEST_' "$SELECTS_TEST_CREDS_FILE"); set +a`. Locally, put them in `.env` (see `.env.example`). They can also be Cursor secrets (Dashboard > Cloud Agents > Secrets). Never commit them.
- Make sure it exists: `npm run seed:test-account`. Idempotent. It signs in (or creates the account once), whitelists the email, and writes the `users/{uid}` profile. It uses the public web key under `firestore.rules`; no service account needed.
- Sign in through the UI: `/login`, enter the email, "Already have an account", password. Playwright: `ensureAuthed(page)` or `signIn(page, ...testAccount())` from `e2e/helpers.ts`.
- If the env vars are missing, stop and report that the secrets are missing. Do not invent an account.

Do not:

- Sign up through `/join` or "Create new account" against production Firebase (`mvplockedin`).
- Generate `selects.verify.<timestamp>@example.com` style accounts, or any other throwaway login.
- Change the shared account's password or delete its data.

## Testing new-user flows

Onboarding and sign-up (F2, F15, F16, F17) need a brand-new user each run. Those tests call `requireEmulatorForSignup()` and skip unless `VITE_FIREBASE_EMULATOR=1`, which points the app at the local Firebase emulator, where accounts vanish on restart:

```bash
npx firebase-tools emulators:start --only auth,firestore --config firebase.emulator.json
VITE_FIREBASE_EMULATOR=1 npx playwright test e2e/flows.spec.ts -g "F2|F15|F16|F17"
```

To sign in to the emulator by hand, seed the shared account there first: `VITE_FIREBASE_EMULATOR=1 npm run seed:test-account`.
