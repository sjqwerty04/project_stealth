# Verify Selects

Launch, doctor, drive, evidence, and cleanup for the Selects visual rebrand.

## Launch

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Playwright `webServer` in `playwright.config.ts` starts this automatically.

```bash
npm run test:e2e
```

Videos: `artifacts/verify/<flow>-<viewport>/flow.webm`

## Doctor

- Port `5173` responds.
- Firebase project `mvplockedin` is live.
- `/join` sets `sessionStorage.appInvite=1`.
- Optional: `SELECTS_TEST_EMAIL` / `SELECTS_TEST_PASSWORD` for F1.
- TMDB optional. Hunt/onboarding fall back to the local catalog.

## Drive

Flows live in `e2e/flows.spec.ts` (F0–F14) and `e2e/smokes.spec.ts`. Feature map: `features/` in this skill.

## Evidence

- `artifacts/verify/<id>/flow.webm`
- stills, `console.log`, `thresholds.json`
- `.audit/selects-rebrand.tsv`

## Cleanup

Do not delete `artifacts/verify`. Auth scratch: `e2e/.auth/` (gitignored).
