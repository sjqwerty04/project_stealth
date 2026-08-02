# ViewFindr MVP — Launch Requirements

**Status:** proposed, pending sign-off on the open questions in §11
**Goal:** compress "what should we watch tonight" from ~20 minutes to ~10 seconds
**Scope:** the first cohort of real users

---

## 1. Diagnosis: where the 20 minutes actually goes

The 20 minutes is not one slow step. It is six fast steps repeated across five apps. Externally measured:

| Finding | Value | Source |
| --- | --- | --- |
| Time per session deciding what to watch (US) | 12 min, up from 10.5 min in 2023 and 7.5 min in 2019 | Gracenote *State of Play* 2025 |
| Same, ages 18–34, globally | 16+ min | Gracenote 2025 |
| Abandon the session entirely | 19% overall, 29% of ages 18–24 | Gracenote 2025 |
| Would cancel a service because it's hard to find something | 49%; 54% of ages 18–34 | Gracenote 2025 |
| Time flipping across services before deciding | 30 min across 4 services | Plex/OnePoll 2022 |
| Struggle to identify which platform has a title | 50% of Americans | Plex/OnePoll 2022 |
| Would watch more if content were easier to find | ~50% | Deloitte *Digital Media Trends* 2024 |

The decomposition, ranked by how often users actually name it:

1. **No stopping rule.** Users evaluate exhaustively when allowed to. In a 12-interview qualitative study, *all 12* reported 10+ minutes of browsing, some up to 30. One described watching *five trailers* before choosing. The failure is unbounded choice, not insufficient information.
2. **Abandonment to a zero-decision feed.** Users who give up don't switch to another movie app — they switch to YouTube or TikTok, because those require no decision at all. That is the real competitor.
3. **Already-seen and repetitive recommendations.** The most-cited *fixable* complaint. Critically, users refuse to maintain the state that would fix it: they don't rate, and they don't clean their lists. Seen-state must be inferred, never requested.
4. **"Where can I actually watch this?"** — and the answer being wrong. Aggregators are punished brutally for staleness, because a wrong answer costs the user the exact thing they came to save.
5. **Recommendations match genre, not mood / energy / runtime.** Correct-but-useless. Users describe recommendations that never leave their existing box and never account for having 90 minutes and low energy.

### 1.1 The number that should drive the design

The industry number is 12 minutes. The *per-app tolerance* is 60–90 seconds — Netflix's own research (Gomez-Uribe & Hunt, *ACM TMIS*) found a member reviews 10–20 titles, ~3 in detail, before deciding or leaving, and that past 60–90 seconds "the risk of the user abandoning our service increases substantially."

Nobody spends 12 patient minutes in one app. They spend 90 seconds in each of five apps, then quit. **Design to the 90-second budget.** Hitting 10 seconds then gives ~9x headroom instead of a target that permits a slow product.

### 1.2 Two prior experiments we must not repeat

- **Netflix shipped "Play Something" (2021) and killed it in Jan 2023 for low usage.** Pure randomisation dies. Users will not accept a coin flip for a 2-hour commitment. Every pick needs (a) a constraint *the user supplied* and (b) a one-line reason.
- **"Tinder for movies" is a graveyard.** The pattern has shipped a dozen-plus times since 2018; most go quiet within 18 months. It needs two co-present, onboarded people at the exact moment they have the least patience. The one surviving implementation (Reelgood's Swipe with Friends) works because it's a no-signup web URL inside a product people already open for another job. **Group matching is not the wedge.**

---

## 2. What "10 seconds" means, precisely

Vague targets don't ship. The launch metric is:

> **TTFD (Time To First Decision):** milliseconds from app-open to the user having tapped "I'll watch this" on a specific title.

Sub-metrics, each independently measured:

| Metric | Definition | Launch target | Hard ceiling |
| --- | --- | --- | --- |
| **TTFP** | app-open → first pick fully rendered (title, poster, reason) | **≤ 2.0 s p75** | 4.0 s p95 |
| **TTNP** | tap "next" → next pick rendered | **≤ 150 ms p75** | 400 ms p95 |
| **TTFD** | app-open → decision committed | **≤ 10 s p75** | 20 s p95 |
| **Decision rate** | sessions ending in a commit | **≥ 55%** | — |
| **Abandon rate** | sessions ending with no commit | **≤ 25%** | vs. 19–29% industry |

TTFP is the number that matters architecturally. If the first pick takes 9 seconds, no amount of UI polish gets TTFD under 10.

---

## 3. Current state, measured

Measured in this repo, not estimated.

**Bundle:** a single 1,068 kB JS chunk (323 kB gzipped). Every screen — admin, orbit, onboarding, DNA — is eagerly imported in `src/App.tsx`. There is no route splitting and no `manualChunks`.

**Recommendation critical path** (`src/hooks/useRecommendation.ts`), the awaited chain in order:

```
1  getDocs(watched_recommendations)          ~100-300ms   sequential
2  getDocs(watchlist)                        ~100-300ms   sequential
3  getDocs(skipped_recommendations)          ~100-300ms   sequential
4  deleteDoc × K expired skips               ~100-300ms   each, sequential
5  POST /api/claude → pick a title           ~2000-6000ms non-streamed
6  TMDB /search/movie                        ~200-400ms
7  TMDB /movie/{id}                          ~200-400ms
8  POST /api/claude → write the reason       ~2000-6000ms non-streamed
9  getDocs(skipped_recommendations) again    ~100-300ms
10 updateDoc × M skip counters               ~100-300ms   each, sequential
```

**8+ round trips, two of them non-streamed LLM calls.** Typical wall clock 6–14 s; worst case (large history, JSON repair retries, many skip counters) 15–20 s. Then add cold start: bundle → auth → whitelist `getDoc` → `calendar_logs` snapshot, which gates the entire home screen behind `if (eventsLoading) return <Loading Cinema…>`.

**Skip re-runs the whole chain from scratch.** There is no precomputation and no prefetch on this path.

So the product currently takes roughly as long as the problem it claims to solve. That is the launch blocker.

### 3.1 The one place the codebase already gets it right

Orbit prefetches all four directional moves in parallel immediately on entry (`src/lib/orbitEngine.ts`), so swipes are instant when warm. **That pattern is the answer.** It just needs to be applied to the primary recommendation path, which is where the traffic actually is.

---

## 4. Architecture: a shelf, not a kitchen

You cannot cook a recommendation in 10 seconds. One non-streamed LLM call is 2–6 s and the chain needs several network hops. Any design that computes the pick *while the user waits* has already lost.

**Therefore: the read path never calls an LLM.** Picks are computed ahead of time and served from a warm queue.

```
WRITE PATH (async, off the critical path)          READ PATH (what the user waits on)
──────────────────────────────────────            ────────────────────────────────────
taste event: log / rate / import / skip            app open
        │                                                 │
        ▼                                                 ▼
  refill tonight_queue                            read tonight_queue      ← 1 Firestore read
  (LLM + TMDB hydration, 5-15s,                          │
   nobody is watching)                                    ▼
        │                                          render pick #1         ← target ≤ 2.0s
        ▼                                                 │
  queue: 5 fully-hydrated picks ────────────────▶  "next" pops locally    ← target ≤ 150ms
```

Three properties this buys:

1. **TTFP becomes one Firestore read.** The LLM latency moves off the user's clock entirely.
2. **"Next" is free.** Popping a local array is instant, which is what makes a 3-tap decision feel like one gesture.
3. **Cost per session drops.** Today, every skip burns two LLM calls. Batched refill amortises one generation across five picks.

### 4.1 Staging (both stages are cheap; ship stage 1 tomorrow)

- **Stage 1 — client prefetch (ships tomorrow).** On app open, generate pick #1 and immediately prefetch #2 and #3 in the background. Every consume triggers a refill. First open of a session still pays generation cost; every subsequent interaction is instant. No new infrastructure.
- **Stage 2 — server-side warm queue (post-launch).** A Vercel cron or Firestore trigger refills `users/{uid}/tonight_queue` on taste events, so even the *first* open of a session is a single read. This is the version that actually hits ≤ 2.0 s p75 cold.

Stage 1 is a strict subset of stage 2's data model, so stage 2 is additive — no rewrite.

### 4.2 Correctness rule that must live in code, not in the prompt

LLMs do not reliably honour exclusion lists. Independent projects hit this repeatedly; one changelog records deep-research models "totally ignore the exclusion list and recommend tons of excluded titles."

The prompt already says "NEVER recommend any movie from `<already_watched>`" and that is not sufficient. **Post-generation, filter every candidate against the seen-set in code and re-ask if the set comes back empty.** Recommending an already-seen film is the single most-cited fixable complaint (§1, cause 3) and it is trivially preventable.

Related: today the exclude list is up to 1000 titles inlined into every prompt. At 500+ items that is a 20–40 kB prompt on the critical path, paid on every single recommendation, to enforce a constraint the model ignores anyway. Ask for N candidates, filter in code, cap the prompt.

---

## 5. MVP scope: one flow

The launch bet is a single flow, executed fast. Everything else is already built and can stay behind the existing routes, but it is not what we measure or market.

**The flow — three taps, hard-capped:**

```
  ┌─ Tap 1 ──────────┐   ┌─ Tap 2 ─────────┐   ┌─ Tap 3 ────────┐
  │ Constraint        │   │ Pick            │   │ Commit         │
  │ mood · energy ·   │──▶│ 3-5 candidates  │──▶│ Play / Tonight │
  │ runtime · who     │   │ no "load more"  │   │ / Log it       │
  └───────────────────┘   └─────────────────┘   └────────────────┘
```

Non-negotiable properties, each traceable to a diagnosed cause:

- **Hard cap of 3–5 candidates with no "load more."** This is the stopping rule (cause 1). Unbounded lists are how you rebuild the problem.
- **A user-supplied constraint gates every pick.** This is what Netflix's Surprise Me lacked (§1.2).
- **Every pick carries a one-line "why this, for you."** Same reason. A pick with no rationale reads as a coin flip.
- **Nothing already seen ever appears.** Enforced in code (§4.2).
- **Mood, energy, and runtime are first-class axes, not genre.** Cause 5. Runtime especially: it's cheap, it's an explicitly requested feature, and it buys credibility immediately.

### 5.1 Cut list — build later, not tomorrow

Cut with reasons, so these are decisions rather than omissions:

| Cut | Why |
| --- | --- |
| Synchronous group swipe | Documented graveyard (§1.2). v1.1, on web, no signup, modelled on Reelgood. |
| Spoiler-safe review summarisation | I searched specifically for this pain and found the opposite: users *seek out* reviews as a trust shortcut. Not a friction point. The one-line rationale already covers it. |
| Pure "surprise me" / randomiser | Netflix ran this at scale and killed it. |
| Orbit, DNA, Constellation as launch surfaces | Genuinely nice, but they are exploration toys. They serve "browse for fun," not "decide in 10 seconds," and Orbit's entry costs 4 parallel LLM calls. Keep the routes, drop from onboarding and marketing. |
| IMDb techspecs scraping (IMAX / Dolby badges) | A scrape on a detail page to render a badge. Zero decision value. Off by default. |
| Multi-region availability | Launch US-only and say so. `useMovieDetails.ts` already hardcodes `results.US`; make that an explicit, visible constraint rather than a silent bug for the first non-US user. |

### 5.2 Bloat to delete before launch

Measured: ~4,000 lines of dead or duplicated source, plus 13 MB of committed binaries.

| Item | Size | Note |
| --- | --- | --- |
| `BUG.mov` | 13 MB | Debug video committed to the repo |
| `src/prototype/HomeV2.tsx` | 1,153 lines | Dead fork of `MovieCalendarApp`, not routed |
| `prototype-demo/index.html` | 925 lines | Duplicates HomeV2 again, with a hardcoded TMDB key |
| `prototype-orbit/index.html` | 530 lines | Duplicates OrbitScreen, hardcoded TMDB key |
| `src/lib/gemini.ts` | 459 lines | Zero imports; would put a Gemini key in the client if ever wired |
| `src/hooks/useExplorationSession.ts` | 242 lines | Duplicates `ExplorationContext` |
| `IMG_0943.jpg`, `poster-crawl-test.html`, `movie_updates.ipynb`, `src/App.css` | — | Scratch files |
| Unused dependencies | 10 packages | `three`, `@react-three/fiber`, `@react-three/drei`, `tunnel-rat`, `@supabase/supabase-js`, `@google/generative-ai`, `@tanstack/react-query`, `date-fns`, `clsx`, `tailwind-merge` — zero imports |

Also worth consolidating, because it will keep costing time: **16 distinct movie-shaped TypeScript types**, **11 hand-rolled `buildImageUrl` helpers**, and **8 copies of `searchTMDB`** across 14 files that each call TMDB directly. One `src/lib/tmdb.ts` retires all of it. The three unused React Three Fiber packages are the tell that this repo has been accreting experiments faster than it retires them — worth a standing habit, not just a one-time cleanup.

---

## 6. Functional requirements

Numbered so they can be tested and argued with individually.

### FR-1 Constraint capture
- **FR-1.1** Present mood, energy, runtime, and who's-watching as the entry point. Every axis skippable; defaults inferred from history and time of day.
- **FR-1.2** Runtime is a bounded filter with concrete buckets (`< 90 min`, `90–120`, `120–150`, `150+`), not a slider.
- **FR-1.3** Total capture cost ≤ 1 tap for a returning user. Remember the last constraint set and offer it as a one-tap "same as last time."

### FR-2 Candidate generation
- **FR-2.1** Return exactly 3–5 candidates. No pagination, no infinite scroll, no "load more" anywhere in this flow.
- **FR-2.2** Every candidate carries a ≤ 140-character rationale referencing something the user actually watched or asked for.
- **FR-2.3** Filter every candidate against the seen-set **in application code** after generation. Re-ask if the filtered set is empty.
- **FR-2.4** Serve from the prefetched queue when warm. Generate inline only on a cold miss, and show a skeleton with the constraint echoed back, never a bare spinner.
- **FR-2.5** Respect the constraint from FR-1. A pick that violates a stated runtime or mood constraint is a bug, not a surprise.

### FR-3 Commit
- **FR-3.1** Three terminal actions, always visible without scrolling: **Play**, **Save for tonight**, **Log as watched**.
- **FR-3.2** "Play" deep-links into the provider app where we have a link, and degrades to the provider's web page. Never a dead end.
- **FR-3.3** Committing writes a taste event and triggers an async queue refill.
- **FR-3.4** "Not this" is one tap and advances instantly from the local queue. It never blocks on the network.

### FR-4 Seen-state, captured passively
- **FR-4.1** Letterboxd and IMDb import are offered during onboarding as the primary personalisation step. `useIMDBImport.ts` and `useLetterboxdImport.ts` already exist — surface them.
- **FR-4.2** Never require the user to rate or curate anything to get a good pick. They have told us repeatedly they won't.
- **FR-4.3** Treat commits, skips, and detail-page dwell as implicit signal.

### FR-5 Availability
- **FR-5.1** Show only titles available on the user's declared services, or clearly mark the ones that aren't.
- **FR-5.2** Capture the user's services once, during onboarding, in one multi-select screen.
- **FR-5.3** Never show availability we can't substantiate. A confident wrong answer is worse than "we're not sure" — see §10.

---

## 7. Non-functional requirements

### NFR-1 Latency budget
The p75 budget for a warm first pick, which is the number the whole architecture serves:

| Hop | Budget |
| --- | --- |
| Bundle download + parse (split, route-level) | 400 ms |
| Auth resolution | 300 ms |
| Queue read (1 Firestore doc) | 250 ms |
| Render + poster from cache | 300 ms |
| **Total TTFP** | **≤ 1.25 s** (target ≤ 2.0 s p75) |

Rules that keep it there:
- **NFR-1.1** No LLM call on any read path. Ever. This is the load-bearing constraint.
- **NFR-1.2** Independent I/O is parallel. Sequential `await` of independent reads is a defect.
- **NFR-1.3** No blocking full-screen spinner on `/app`. Render the shell and skeletonise.
- **NFR-1.4** Route-level code splitting. The initial chunk carries the decision flow and nothing else.
- **NFR-1.5** Writes on the critical path are batched, or deferred past render.

### NFR-2 Cost per session
- **NFR-2.1** Target ≤ 1 LLM generation per session for a returning user, amortised across 5 picks. Today a user who skips twice burns six.
- **NFR-2.2** Cap prompt size. Send the top-N most informative history items, not 1000 titles.
- **NFR-2.3** Cache availability server-side per (title × country). At the MVP API tier (~25k requests/month ≈ 800/day) an uncached per-view lookup exhausts quota immediately.

### NFR-3 Graceful degradation
- **NFR-3.1** If the LLM is down or slow, fall back to a deterministic non-LLM ranker over TMDB plus the user's taste vector. The app must always produce a pick.
- **NFR-3.2** If availability is unknown, say so. Don't guess.
- **NFR-3.3** Every enrichment (ratings, techspecs, Reddit context, Letterboxd rating) is non-blocking and independently failable. Several already are — keep it that way.

### NFR-4 Instrumentation (day-one, not later)
Ship blind and you'll spend the first week guessing. Log with a session id: `session_start`, `constraint_set`, `pick_shown` (+ queue-warm boolean, + latency), `pick_rejected`, `commit` (+ action), `session_abandoned`, `llm_call` (+ latency, + cache-hit). That set computes every metric in §2.

---

## 8. Data model and extension seams

Where each future feature plugs in without a rewrite. The existing per-user subcollection layout in `firestore.rules` is sound; this adds to it.

```
users/{uid}
  ├── profile              services, region, default constraints
  ├── taste_vector         derived; the single input to generation      ← seam A
  ├── tonight_queue        precomputed hydrated picks + generated_at    ← seam B
  ├── seen_index           flat title→true set, O(1) exclusion         ← seam C
  ├── calendar_logs        existing
  ├── watchlist            existing
  ├── watched_recommendations / skipped_recommendations  existing
  └── events               append-only signal log                      ← seam D
```

- **Seam A — `taste_vector`.** Generation reads one derived document instead of re-deriving taste from four collections on every request. Swapping the recommender (LLM → embeddings → collaborative filtering) becomes a change behind one interface.
- **Seam B — `tonight_queue`.** Client prefetch (stage 1) and server refill (stage 2) write the same shape, so stage 2 is additive. Group picking later becomes an *intersection* of two queues — no new pipeline.
- **Seam C — `seen_index`.** Makes FR-2.3 O(1) instead of loading and string-joining every watched title per request. This is the fix for the 1000-title prompt.
- **Seam D — `events`.** Append-only signal log. Anything analytical or ML-shaped later reads from here rather than needing new instrumentation retrofitted.

One extension the seams should anticipate, because the evidence for it is stronger than its current priority: **capture at the moment of word-of-mouth.** Social proof is the dominant real-world discovery channel — Deloitte found 52% of fans (73% of Gen Z fans) discover on social platforms, and the academic work on choice deferral found social capital measurably *reduces* it. The highest-leverage capture moment isn't 9 pm on the couch; it's the instant a friend mentions a title. A share-sheet ingest that writes to `seen_index`/`watchlist` is small, and it feeds the same queue.

---

## 9. Definition of done for launch

- [ ] TTFP ≤ 2.0 s p75 on a warm queue, measured on a real device on 4G
- [ ] TTNP ≤ 150 ms p75
- [ ] Zero already-seen titles in the flow, verified against a seeded 500-title account
- [ ] Every pick renders a rationale and respects the stated constraint
- [ ] Availability correct or explicitly unknown for the top 50 titles, spot-checked by hand
- [ ] Instrumentation from NFR-4 landing in a queryable place
- [ ] §10 blockers closed
- [ ] A smoke test exists. There are currently **zero tests and no CI** in this repo; the decision flow needs at least one end-to-end test before it meets real users

---

## 10. Launch blockers

These are not features. They are conditions of shipping.

**B-1 — TMDB / JustWatch attribution and commercial terms.** `useMovieDetails.ts` calls TMDB `/watch/providers`, which is JustWatch-derived. TMDB requires per-item JustWatch attribution ("we expect a reference or logo on each media item"), and the app currently has none — grepping `src/` for JustWatch attribution strings returns nothing. TMDB's remedy for non-compliance is revoking API access. TMDB also requires a written agreement for commercial use, and their terms name our category explicitly. **Add both attributions now; start the commercial conversation before monetising.**

**B-2 — OMDb is licensed CC BY-NC 4.0. No commercial use, at any tier.** Paid tiers remove rate limits, not the non-commercial restriction. `useMovieDetails.ts` uses OMDb for ratings. If there's any revenue, this has to go.

**B-3 — Deep links are the last inch of the funnel and can't be built in-house.** Netflix, Hulu and Prime IDs are at least mappable. **Disney+ and Max use opaque UUIDs** (`entity-f6174ebf-…`) with no derivation from a TMDB or IMDb ID. TMDB's `/watch/providers` deliberately returns no deep links. So FR-3.2 requires a paid provider. Recommendation: **Streaming Availability API (Movie of the Night), $39/mo, purchased direct** — the only option clearing commercial-use, real deep links, and 66-country coverage at a pre-revenue price. RapidAPI is ~25% more for identical quotas plus bandwidth fees. Watchmode ($349/mo) is the scale path.

**B-4 — Six `/api/*` endpoints are unauthenticated, unrate-limited, and `Access-Control-Allow-Origin: *`.** Anyone who finds the deployment URL can spend our Anthropic budget. `api/imdb-techspecs.ts` scrapes IMDb server-side from our IP. Needs an auth check and a per-user rate limit before public traffic.

**B-5 — A TMDB key is hardcoded in two committed prototype HTML files** (`prototype-demo/index.html:285`, `prototype-orbit/index.html:150`). Rotate it and delete the files. Separately, `VITE_CLAUDE_API_KEY` is misnamed: the `VITE_` prefix means anything under it is public in the client bundle. The server reads it as `process.env`, so it works, but the name invites someone to use it client-side. Rename to `CLAUDE_API_KEY`.

---

## 11. Open questions

Each has a default I've assumed so nothing is blocked. Correct the ones I've guessed wrong; the first four change the build.

**Q1 — Is the wedge solo or group?** Everything above assumes **solo**, because group needs two co-present onboarded people at the moment of least patience, and the standalone-group graveyard is well documented. If group is actually the wedge, the queue model still holds (intersect two queues) but onboarding and the invite path change materially.
*Assumed: solo, group in v1.1 as a no-signup web URL.*

**Q2 — Are we paying for availability data?** This is the largest single scope fork. Without a paid provider, FR-3.2's Play button can't work for Disney+ or Max, and the honest MVP framing becomes "what to watch" without "where." $39/mo makes it real.
*Assumed: yes, Streaming Availability API at $39/mo.*

**Q3 — Who is the launch cohort, and how many?** The whitelist gate in `AuthContext` and the Streamlit admin imply a controlled beta. This sets the API tier, whether B-4's rate limiting is urgent or merely important, and whether the stage-1 client prefetch is sufficient or stage 2 is needed immediately.
*Assumed: < 500 invited users, US-only, whitelist stays on.*

**Q4 — Is a good pick from a cold-start user in scope?** Users with no import and no history are the hardest case and the majority of day-one signups. Either the onboarding import (FR-4.1) is mandatory, or there's a taste-free fallback path.
*Assumed: import is strongly encouraged but skippable, with a curated-popular fallback.*

**Q5 — Movies only, or TV too?** `useMovieSearch` already queries TV, but the recommendation path is movie-only and Letterboxd (the taste source) is movies-only. TV changes the runtime axis fundamentally — "what to watch tonight" for a series means "next episode," which is a different product.
*Assumed: movies only at launch.*

**Q6 — Does Orbit stay in the launch build?** It's the most distinctive thing here and probably the best retention hook long-term, but it serves browsing, not deciding, and entry costs four parallel LLM calls. Keeping it costs bundle size and support surface.
*Assumed: route stays, removed from onboarding and marketing, not measured.*

**Q7 — What's the acceptable cost per session?** This bounds how aggressively we prefetch. Prefetching three picks per session at current prompt sizes is real money at scale.
*Assumed: ≤ $0.02/session, which the batched-refill model comfortably meets.*

**Q8 — iOS App Store, or web/PWA?** The Capacitor shell exists and PWA is configured. Native changes the launch timeline (review), and it's the only path to reliable deep links on some services.
*Assumed: web/PWA at launch, native follows.*

---

## 12. Summary

The product currently takes about as long as the problem it solves: 6–14 seconds for one recommendation, plus cold start, plus a full re-run on every skip. The cause is architectural, not a matter of tuning — the read path computes with two blocking LLM calls in it.

The fix is to stop computing on read. Precompute picks, serve them from a warm queue, refill asynchronously. That single change moves the dominant latency off the user's clock and makes "next" instant, which is what turns a 3-tap flow into something that feels like one gesture.

On top of that: hard-cap the candidate set so there's a stopping rule, gate every pick on a user-supplied constraint so it doesn't read as a coin flip, enforce the already-seen exclusion in code because the model won't, and pay the $39/mo for deep links because the last inch of the funnel can't be built in-house.
