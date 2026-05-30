# AGENT GUIDE: ViewFindr / Selects Codebase

This file is an in-depth orientation guide for engineers, PMs, and AI/code agents working in this repository.

---

## 1) Product Manager Overview

### What is Selects?

In this codebase, "Selects" maps to the curated discovery and recommendation experience centered on:

- personalized recommendations,
- directional exploration ("Orbit"),
- and decision support around what to watch next.

The customer-facing brand language in the app is `ViewFindr` (see `vite.config.ts` manifest metadata), while "Selects" is the conceptual product layer for curation and discovery.

### Problem Selects is solving

Users have too many options and too little confidence in what to watch next. Existing discovery is often:

- generic (algorithmic but impersonal),
- disconnected from personal taste evolution over time,
- and not integrated with a journaling workflow.

Selects solves this by combining:

1. **Taste memory** (calendar logs, likes/dislikes, watchlist),
2. **Taste reasoning** (Claude prompts for "why this"),
3. **Taste exploration** (Orbit directional browsing),
4. **Taste continuity** (imports, saved vibes, watched timelines).

### Primary user jobs-to-be-done

- "Help me decide what to watch tonight, quickly."
- "Track what I watched and how I felt about it."
- "Explore adjacent films by visual/story/emotional dimensions."
- "Bring my past data from IMDb/Letterboxd so recommendations improve."

### Product pillars

- **Capture**: Log watched/planned films by date.
- **Recommend**: Generate one high-confidence recommendation with rationale.
- **Explore**: Navigate taste space (Orbit).
- **Remember**: Persist history, skips, vibes, watchlist.

---

## 2) High-Level Architecture

### Runtime surfaces

1. **Main Web App** (React + Vite + Firebase)
   - Entry: `index.html` -> `src/main.tsx` -> `src/App.tsx`
2. **Serverless API layer** (Vercel `/api`)
   - `api/claude.ts`, `api/imdb-techspecs.ts`
3. **Standalone prototypes** (plain HTML/CSS/JS)
   - `prototype-demo/index.html` (home/calendar concepts)
   - `prototype-orbit/index.html` (Orbit concepts)
4. **Admin dashboard** (Streamlit)
   - `admin-dashboard/`
5. **Capacitor iOS shell**
   - `ios/` + `capacitor.config.ts`

### Core dependencies and why they exist

- **React + React Router**: SPA routing and stateful UI composition.
- **Firebase Auth + Firestore**: user auth, personalized persisted data.
- **TMDB / OMDb APIs**: movie metadata, imagery, external IDs, trailers.
- **Claude API (via proxy)**: personalized recommendation and pattern reasoning.
- **Framer Motion + custom haptics**: premium interaction feel (especially Orbit).
- **Vite PWA plugin**: installable web app and cache strategy.

---

## 3) Repository Map: Why each folder exists

### Root application and infra

- `index.html`: Vite web app HTML entry.
- `package.json`: scripts, dependencies, build/dev contract.
- `vite.config.ts`: Vite + Tailwind + PWA + TMDB runtime caching.
- `vercel.json`: SPA rewrites and immutable caching headers.
- `firebase.json`: Firebase project integration/deploy metadata.
- `firestore.rules`: data access boundaries and product data model contract.
- `firestore.indexes.json`: Firestore query/index performance support.
- `tsconfig*.json`: TypeScript compile topology (app/node split).
- `README.md`: developer run/deploy instructions.

### `src/` (main product app)

- `src/main.tsx`: app bootstrap.
- `src/App.tsx`: route graph and auth gates.
- `src/index.css`, `src/App.css`: global styling surfaces.

### `src/contexts/`

- `AuthContext.tsx`: source of truth for auth + whitelist gating.
- `ExplorationContext.tsx`: stateful "taste exploration" logic and vibe intelligence.

### `src/hooks/`

Hooks encapsulate each domain boundary so UI remains declarative:

- `useAuth.ts`: auth context accessor.
- `useUserProfile.ts`: profile retrieval/update boundary.
- `useCalendarLogs.ts`: calendar CRUD + activity logging.
- `useRecommendation.ts`: recommendation generation and skip/rating flow.
- `useMovieSearch.ts`: TMDB-backed discovery search.
- `useMovieDetails.ts`: movie detail aggregation from TMDB/OMDb.
- `useWatchlist.ts`: watchlist CRUD.
- `useSimilarVibes.ts`: adjacent recommendations/vibe graph behavior.
- `useExplorationSession.ts`: session behavior for discovery interactions.
- `useIMDBImport.ts`: IMDb URL/CSV ingestion and normalization.
- `useLetterboxdImport.ts`: Letterboxd ingest path.
- `usePinchGesture.ts`: gesture abstraction for Orbit interactions.

### `src/lib/`

Shared infrastructure/adapters:

- `firebase.ts`: Firebase app/auth/db initialization.
- `claude.ts`: client-side Claude API adapter (via serverless proxy).
- `gemini.ts`: alternate/experimental generative integration.
- `orbitEngine.ts`: directional recommendation engine for Orbit.
- `analytics.ts`: product analytics events.
- `activityLogger.ts`: durable activity logging.
- `haptics.ts`: haptic effect abstraction.

### `src/screens/`

Route-level product surfaces:

- `SplashScreen.tsx`: routing handoff based on auth state.
- `LoginScreen.tsx`: whitelist + sign-in/sign-up UX.
- `WaitlistScreen.tsx`: non-whitelisted holding flow.
- `DiscoverScreen.tsx`: search + pattern insights.
- `MovieDetailScreen.tsx`: movie deep context and actions.
- `OrbitScreen.tsx`: directional cinematic exploration mode.
- `WatchedScreen.tsx`: watched timeline + imports.
- `WatchlistScreen.tsx`: watchlist management + imports.
- `SavedVibesScreen.tsx`: saved preference pattern retrieval.

### `src/components/`

Composable UI primitives and vertical features:

- `ProtectedRoute.tsx`: auth/whitelist route gatekeeper.
- `RecommendationCard.tsx`: "next watch" interaction unit.
- `SearchResultCard.tsx`: search result rendering.
- `PatternAssistant.tsx`: insight UI for discovery patterns.
- `MovieActions.tsx`: repeated movie action controls.
- `RatingBadges.tsx`, `TechBadges.tsx`: attribution/value signal overlays.
- `ProfileDropdown.tsx`: account controls.
- `FeedbackFAB.tsx`, `FeedbackModal.tsx`: user feedback capture.
- `CleanupIMDBCalendar.tsx`: data hygiene tool for imported entries.

#### `src/components/orbit/` (Orbit-only UI surface)

- `OrbitCard.tsx`: a single Orbit card.
- `OrbitCardStack.tsx`: stack/arrangement behavior.
- `OrbitControls.tsx`: directional controls.
- `ConstellationView.tsx`: alternate map-style view.
- `ParryTransition.tsx`: visual transition effect in Orbit.

### `src/stores/`

- `orbitStore.ts`: Orbit state machine (Zustand), directional and transition state.

### `src/prototype/` (React prototypes embedded in app code)

- `MovieCalendarApp.tsx`: current `/app` route implementation.
- `HomeV2.tsx`: alternate home prototype not currently wired as primary route.

### Standalone prototypes (outside React app)

- `prototype-demo/index.html`: isolated calendar/home experiment server.
- `prototype-orbit/index.html`: isolated Orbit experiment server.

Purpose: rapid iteration without impacting deploy path or route complexity.

### `api/` (Vercel serverless)

- `claude.ts`: secure-ish serverless proxy for Anthropic calls (CORS + model passthrough).
- `imdb-techspecs.ts`: IMDb technical spec scraping proxy endpoint.

### `admin-dashboard/`

Streamlit operational tooling:

- `app.py`: dashboard app shell.
- `pages/1_Users.py`: whitelist/user management view.
- `pages/2_Activity.py`: activity log and monitoring view.
- `streamlit-secrets.toml` + example: admin runtime secrets.
- `README.md`: admin setup/deploy.

### `ios/`

Capacitor iOS wrapper for mobile app packaging:

- Native project assets and wrapper metadata.
- Exists so the web app can ship as an installable native shell.

### `public/`

- Static app icons and PWA assets (manifest-linked).

---

## 4) Route-Level User Journey (why flow is designed this way)

### Authentication + access

`/` -> `SplashScreen` -> route to `/login`, `/waitlist`, or `/app` depending on auth + whitelist.

Why: controlled beta rollout and lower support cost while product evolves quickly.

### Calendar-first home

`/app` -> `MovieCalendarApp` + `RecommendationCard`.

Why: puts "log + decide next" in one place, minimizing context switching.

### Discover and patterning

`/discover` -> search and pattern explanation.

Why: gives users confidence and explainability for recommendations.

### Movie detail conversion page

`/movie/:id` as action hub:

- log to calendar,
- add to watchlist,
- launch Orbit (`/orbit/:id`).

Why: central conversion node where intent is strongest.

### Orbit exploration mode

`/orbit/:id` for directional recommendation traversal.

Why: transforms static recommendation into an exploratory "taste map."

### Data continuity

`/watched`, `/watchlist`, `/cleanup`, `/vibes`.

Why: preserve user trust by making data visible, editable, and recoverable.

---

## 5) Data Model and Contracts

Defined by `firestore.rules`:

- `whitelist/{email}`: access-gating contract.
- `users/{uid}` root profile document.
- `calendar_logs`: journaled watch/planning events.
- `watched_recommendations`: explicit recommendation outcomes.
- `watchlist`: future intent queue.
- `skipped_recommendations`: temporary suppression buffer.
- `saved_vibes`: persisted taste-profile snapshots.
- `feedback_inbox`, `activity_logs`: telemetry and ops lanes.

Rationale: per-user subcollections isolate concerns and simplify rule logic.

---

## 6) External Services and Why

- **TMDB**: broad movie metadata + posters/backdrops + videos for trailer embed.
- **YouTube Embed**: playback surface using TMDB video keys.
- **OMDb**: secondary metadata enrichment (esp. ratings/aliases).
- **Anthropic Claude**: recommendation reasoning and pattern text generation.
- **Firebase Auth/Firestore**: identity + persisted personalization.
- **Vercel Functions**: backend shim for AI and scraping endpoints.

---

## 7) Staff-Engineer Notes: Technical Intent and Tradeoffs

1. **Prototype isolation is intentional**
   - `prototype-demo/` and `prototype-orbit/` keep high-velocity UI experimentation independent from production route stability.

2. **Hooks-first architecture**
   - Domain behavior is localized in hooks/lib so screens/components remain composable and testable.

3. **Dual-mode backend strategy**
   - Most reads are client-direct to external APIs (TMDB/OMDb), while sensitive AI calls are proxied through `api/`.

4. **Route-level encapsulation**
   - Each major feature has a dedicated screen to reduce coupling and simplify onboarding.

5. **Orbit as a bounded subsystem**
   - Orbit-specific screen/store/lib/components allow parallel iteration without destabilizing non-Orbit flows.

6. **Operational observability**
   - feedback + activity logs + Streamlit admin represent a deliberate lightweight ops plane.

7. **PWA + Capacitor dual distribution**
   - Supports web-first iteration and optional native shell packaging.

---

## 8) Runbook (developer and agent quick start)

### App dev

- `npm install`
- `npm run dev` (UI only)
- `vercel dev` (UI + local `/api/*` emulation for AI paths)

### Build

- `npm run build`
- `npm run preview`

### iOS shell

- `npm run build:ios`

### Prototype servers

- Home prototype: `cd prototype-demo && python3 -m http.server 3333`
- Orbit prototype: `cd prototype-orbit && python3 -m http.server 3334`

### Admin dashboard

- `cd admin-dashboard`
- `pip install -r requirements.txt`
- `streamlit run app.py`

---

## 9) "Why this file exists" quick index (for fast agent lookup)

- `src/App.tsx`: global route contract.
- `src/contexts/AuthContext.tsx`: auth + whitelist policy owner.
- `src/hooks/useRecommendation.ts`: recommendation engine owner.
- `src/lib/orbitEngine.ts`: directional recommendation logic owner.
- `src/stores/orbitStore.ts`: Orbit state machine owner.
- `src/prototype/MovieCalendarApp.tsx`: current production-like home owner.
- `prototype-demo/index.html`: standalone home experimentation owner.
- `prototype-orbit/index.html`: standalone orbit experimentation owner.
- `api/claude.ts`: Claude request proxy owner.
- `firestore.rules`: data access policy owner.

---

## 10) Conversation Context References

Use these prior chats for product intent and design rationale continuity:

- [Home + Orbit Prototype Iteration](621410ad-d547-46d9-9394-9df52859b0f7)

This conversation includes:

- standalone localhost prototype strategy,
- calendar + recommendation hero redesign,
- trailer loading behavior (TMDB video key + YouTube embed),
- Orbit mockup requirements and 3x3 visible card direction.

---

## 11) Guidance for Future Agents

1. Preserve separation between:
   - production React routes (`src/`)
   - standalone prototypes (`prototype-*`).
2. Avoid embedding real API secrets in prototype HTML.
3. Keep route contracts stable (`/app`, `/discover`, `/movie/:id`, `/orbit/:id`).
4. Treat Firestore rules as source-of-truth for data boundaries before new writes.
5. Prefer incremental PRs:
   - UI changes,
   - data contract changes,
   - AI prompt changes,
   - ops/admin changes.

