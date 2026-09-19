# Verify Selects

Launch, doctor, drive, evidence, and cleanup for the Selects visual rebrand.

## Doctor

1. `git fetch origin main`. Branch from `origin/main`, never from a stale local `main`. Cloud agents keep the `brranchh…-dad8` prefix. Feature work is a PR. Merge. Production is the GitHub production deploy of `main` (`selects-film.vercel.app`). Then `npm run assert:prod-main`.
2. Do not `npm run deploy` or `vercel --prod` from a feature branch. `npm run deploy` refuses unless `HEAD` equals `origin/main` after a fetch. Vercel GitHub ships production when a PR merges to `main`.
3. Port `5173` responds.
4. Firebase project `mvplockedin` is live.
5. `/join` sets `sessionStorage.appInvite=1`.
6. Optional: `SELECTS_TEST_EMAIL` / `SELECTS_TEST_PASSWORD` for F1.
7. TMDB optional. Hunt/onboarding fall back to the local catalog.

Laptop, cloud, phone, and the website all follow the same loop: branch off fetched `origin/main` → PR → merge → GitHub prod. Local `npm run dev` is the feature branch. Preview URLs are the PR. The home-screen PWA is production only. After a production SHA change, remove the home-screen icon once and add `https://selects-film.vercel.app` again if the install was a preview URL.

## Launch

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Playwright `webServer` in `playwright.config.ts` starts this automatically.

```bash
npm run test:e2e
```

Videos: `artifacts/verify/<flow>-<viewport>/flow.webm`

## Drive

Flows live in `e2e/flows.spec.ts` (F0–F14) and `e2e/smokes.spec.ts`. Feature map: `features/` in this skill.

## Evidence

- `artifacts/verify/<id>/flow.webm`
- stills, `console.log`, `thresholds.json`
- `.audit/selects-rebrand.tsv`

## Cleanup

Do not delete `artifacts/verify`. Auth scratch: `e2e/.auth/` (gitignored).
