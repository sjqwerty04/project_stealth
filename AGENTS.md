# AGENTS.md

See `agent.md` for the full product/architecture guide and `README.md` for standard developer setup and run instructions. This file holds durable guidance for automated agents.

## Cursor Cloud specific instructions

This is a Vite + React + TypeScript SPA ("Selects" / ViewFindr). The dependency refresh is handled by the startup update script (`npm install`), so you should not need to reinstall by hand.

Primary service — the web app:
- Run dev: `npm run dev` (Vite, serves on `http://localhost:5173/`).
- Lint: `npm run lint` (currently reports many pre-existing errors/warnings across `src/` — this is the repo's baseline, not something to "fix" as part of unrelated work).
- Build: `npm run build` (runs `tsc -b` then `vite build`; succeeds today).

Egress / network caveats (important — these shape what can be tested end to end here):
- The Cloud VM egress allowlist only reaches Google/Firebase hosts (`identitytoolkit.googleapis.com`, `firestore.googleapis.com`). Firebase Auth + Firestore work fully with the hardcoded public config in `src/lib/firebase.ts`.
- `api.themoviedb.org` and `image.tmdb.org` are BLOCKED. All movie discovery, search, trending, onboarding film picker, watchlist hydration, etc. call TMDB directly from the browser and will fail/blank until those domains are allowlisted AND `VITE_TMDB_API_KEY` is provided in a `.env`. `VITE_OMDB_API_KEY` similarly enriches ratings.
- AI features (`src/lib/claude.ts`) call `/api/claude`, which `vite.config.ts` proxies to `https://movie-lcursor.vercel.app`. That Vercel host is also BLOCKED by egress, so AI recommendation/orbit/onboarding-line features fail unless the domain is allowlisted (or you run `vercel dev`, which itself needs Anthropic/OpenRouter keys + egress).

Auth / access model (non-obvious):
- The app is invite-only. `signUp` in `src/contexts/AuthContext.tsx` only succeeds if the email is already whitelisted OR `sessionStorage.pendingInviteCode` is set. Arriving via an invite link sets that key; the Firestore rules let an authenticated user self-whitelist (`whitelist/{email}` create with `allowed: true`). To create a test account without a real invite, set `sessionStorage.setItem('pendingInviteCode', '<anything>')` in the browser console before signing up. Auth writes are real (they hit the live `mvplockedin` Firebase project).

Other surfaces (secondary, not required for the main web app):
- `admin-dashboard/` is a Python Streamlit app (`pip install -r requirements.txt`, `streamlit run app.py`).
- `prototype-demo/` and `prototype-orbit/` are standalone static HTML served via `python3 -m http.server`.
- `ios/` is a Capacitor shell (`npm run build:ios`, macOS/Xcode only).
