---
name: investigate-selects
description: Investigate Selects bugs against production for all users. Use when the user asks to investigate a Selects, Your Selects, poster, watched, or recommendation bug.
---

# Investigate Selects

Every investigation is production and every user. One screenshot or `SELECTS_TEST_EMAIL` is a seed, not the population.

## Do this

1. `git fetch origin main` and `npm run assert:prod-main`. Production is `https://selects-film.vercel.app`, Firebase `mvplockedin`.
2. `npm run investigate:prod`. Read the JSON rates. Do not invent counts.
3. If the script exits 2, the census is blocked. Say blocked. Do not conclude from one account.
4. Local `npm run dev` and Playwright on `:5173` are extra. They are not the census. Local Vite talks to prod Firebase unless `VITE_FIREBASE_EMULATOR=1`.

## Do not

- Treat `/admin` or Streamlit as a Selects dump. They read `whitelist` and `activity_logs` only.
- Use `admin-dashboard/streamlit-secrets.toml`. That key is `viewfindr-233b0`.
- `set` / `update` / `delete` while measuring.
- `npm run deploy` or `vercel --prod` from a feature branch.
- Run `scripts/probe-selects.mjs` as a substitute for stored `lastPicks`.

## Output

Print rates, not anecdotes. Name the flag (`missingCalendarPoster`, `relatedTitleMismatch`, `watchedStillInLastPicks`, `historyStillInLastPicks`).
