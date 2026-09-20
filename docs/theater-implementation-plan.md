# Theater implementation plan

Theater turns a Hunt session into a named film program for the person using Selects. It records committed Hunt queries and film landings, infers one title and two facets, and returns a lineup with one reason per film. The live Theater stays in the current browser tab until the person closes or keeps it. Kept Theaters appear in Library and You. Orbit keeps its existing use of the word vibe.

The program ships as THTR-1 through THTR-5. Each pull request ends in unit, live, and performance evidence. The operator reviews every interaction change before merge.

## How to read this

One box is one unit of work. Every box names the evidence that checks it. A nested box is a sub-step of the box above it. Check a box only when its evidence exists as a file, a log line, a screenshot, a test run, or a SHA. The body is a how-to. The appendices explain and record.

The program runs `pstack/skills/poteto-mode/playbooks/autopilot-stack.md`. Owners build and verify the stack. The operator reviews and lands THTR-1 through THTR-5.

Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

## Program checklist

### Arm the program

- [ ] State the protocol and this plan to the operator, then stop. Start execution only on the operator's explicit go.
- [ ] On the operator's go, arm a `/goal` with this exact text. "`docs/theater-implementation-plan.md` defines THTR-1 through THTR-5 in order. Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Owners build a verified stack. The operator merges. Done means the Theater vocabulary, session model, one-call inference, persistence, five product surfaces, legacy reads, tests, screenshots, video, and performance receipts all match this plan."
- [ ] Read these from trunk at program start. Re-read them at every tick.
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/autopilot-stack.md`
  - [ ] `git show origin/main:pstack/skills/swarm/SKILL.md`
  - [ ] `git show origin/main:pstack/skills/control-ui/SKILL.md`
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/opening-a-pr.md`
  - [ ] `git show origin/main:pstack/skills/how/SKILL.md`
  - [ ] `git show origin/main:pstack/skills/architect/SKILL.md`
  - [ ] `git show origin/main:pstack/skills/principle-model-the-domain/SKILL.md`
  - [ ] `git show origin/main:pstack/skills/principle-prove-it-works/SKILL.md`
- [ ] Arm the 30-minute audit tick. In a local session, use a real terminal `/loop`. In a cloud root, use a cloud-sleeper wake chain.
- [ ] Use this tick prompt verbatim. "Re-read the execution playbook from trunk and the armed /goal. Audit the operation against both and fix drift in this tick. Probe every active lane and judge progress by side effects only. Stand down a stuck lane and dispatch its replacement now. Then post a status message to the operator in chat, whether or not anything changed, with the queue table of PR, owner, state, and head SHA, the verdicts since the last tick, what merged, open operator gates, and blockers."
- [ ] On the operator's hold or stand-down, send every owner a zero-writes order at once.

### Spawn owners

- [ ] Spawn one owner per PR with the full lifecycle that `autopilot-stack.md` names.
- [ ] Follow this dependency graph. THTR-1 starts from `main`. THTR-2 starts from THTR-1. THTR-3 starts from THTR-2. THTR-4 starts from THTR-3. THTR-5 starts from THTR-4.
- [ ] Hold the file boundaries. Each PR touches only the paths listed in its Files block.
- [ ] Hold the review gate. THTR-1, THTR-3, THTR-4, and THTR-5 change an interaction. They wait for the operator's review in chat with screenshots and a video before merge.

### PR mechanics, for every PR

- [ ] Resolve the forge once. Use the repository's dedicated PR tool. Record any fallback. Never require `gt`.
- [ ] Open the PR ready, never draft. A stack child targets its parent branch.
- [ ] Run the repo's lint and typecheck once before the PR-facing push. Push with hooks on.
- [ ] Run `/deslop` before each commit and `/no-comments` before review.
- [ ] Triage every Bugbot and security-reviewer comment on its technical merits.
- [ ] Rebase onto current trunk before babysit and again before the merge-ready report.

### Verdict and merge, for every PR

- [ ] At the merge-ready head SHA, run the swarm. Use one gates lane, the ten live lanes from the PR's Verify, live block, the perf lane, and one audit lane that reads the diff and receipts.
- [ ] Mark the PR clean only when every lane returns `PASS`. Send findings back to the owner. A new head gets a fresh swarm and verdict.
- [ ] Append each clean PR to the linear stack. Never merge, close, or arm auto-merge. Preserve a verdict across a rebase only when the stable patch-id is unchanged and CI passes at the rewritten head.

### Boot recipe, for every live lane

Each live lane runs on its own cloud VM at the PR head. Drive the browser through `control-ui`.

- [ ] Run `git fetch origin <head-branch> && git checkout <head-sha>`.
- [ ] Wait for `/tmp/cursor/async-install/install-user.status`. Run `npm run dev -- --host 0.0.0.0`. Use Firebase emulators for lanes that read or write user data.
- [ ] Mock `**/api/llm` and TMDB with literal fixtures unless the lane explicitly measures the live boundary.
- [ ] Deliver input through `control-ui`. Use the browser network log and the Firebase emulator only as read-only diagnostics.
- [ ] Save every screenshot to `/tmp/swarm-<pr-id>/worker-<n>/<slug>.png`. Return each path with its pass predicate.

## Establish Theater vocabulary and tokens (THTR-1)

**Depends on.** None.

**Files.**

- [ ] Create `scripts/codemod-theater-vocabulary.mjs`.
- [ ] Edit `package.json`.
- [ ] Rename `src/screens/SavedVibesScreen.tsx` to `src/screens/TheatersScreen.tsx`.
- [ ] Rename `src/components/PatternAssistant.tsx` to `src/components/TheaterCard.tsx`.
- [ ] Rename `src/contexts/ExplorationContext.tsx` to `src/contexts/TheaterContext.tsx`.
- [ ] Rename `src/hooks/useSimilarVibes.ts` to `src/hooks/useSimilarFilms.ts`.
- [ ] Edit `src/App.tsx`, `src/components/AppShell.tsx`, `src/components/TabBar.tsx`, `src/components/LibraryHub.tsx`, `src/screens/DiscoverScreen.tsx`, and `src/screens/MovieDetailScreen.tsx`.
- [ ] Edit `src/lib/activityLogger.ts`, `src/lib/analytics.ts`, `src/lib/taste/recordTasteEvent.ts`, `firestore.rules`, `README.md`, `agent.md`, and `admin-dashboard/pages/2_Activity.py`.
- [ ] Delete `src/components/ProfileDropdown.tsx` after `rg 'ProfileDropdown' src` proves that it has no importer.

**Build.**

- [ ] Implement `scripts/codemod-theater-vocabulary.mjs` with rewrite and `--check` modes. Make a second run produce no diff.
- [ ] Rename the feature noun and its symbols to Theater. Keep the words `vibe`, `Vibe`, and `VIBE` only in `src/lib/orbitEngine.ts`, `src/components/orbit/**`, legacy adapters, and legacy test fixtures.
- [ ] Treat ordinary English uses of room as English. Keep phrases such as "the room and the projection", "across the room", and "cutting room".
- [ ] Add `/theaters`. Redirect `/vibes` and `/rooms` to `/theaters`.
- [ ] Keep `saved_vibes`, `pattern`, and `vibe_saved` readable only through named legacy adapters. Add the new `theaters`, `theater`, and `theater_kept` names for new writes.
- [ ] Remove the purple and gray feature palette. Use the existing Figma tokens in `src/index.css`.
- [ ] Add missing `--color-film-yours: #3A6E85`. Keep the verified colors `#0A0A0B`, `#141416`, `#1D1D20`, `#2B2B2F`, `#EFEDE9`, `#B9B6B0`, `#7C7A76`, `#FF3B14`, `#1D5B8A`, and `#8A3A1D`.
- [ ] Keep Archivo, Archivo Narrow, and Martian Mono. Add named utilities for the verified sizes and line heights. Use Verdict 34/95%, Title 26/105%, Lead 19/135%, Body 15/150%, Meta 13/140%, Chip 11/100%, Label 10/100%, and Numeral 32/100%.

**You see.**

- [ ] The app says Theater on Hunt, movie detail, Library, the archive, and You. Orbit still says Vibe and Vibe Match.
- [ ] `/vibes` and `/rooms` replace to `/theaters`.
- [ ] `npm run check:theater-vocabulary` prints `Theater vocabulary OK`.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Add a temporary-root fixture test for the vocabulary script. A non-Orbit file containing `Saved Vibes` exits 1 with its path and line. An Orbit file containing `Vibe Match` exits 0. Run `npm test`.
- [ ] Run `npm run lint`, `npm run build`, and `npm run check:theater-vocabulary`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Open Hunt, Library, movie detail, and Orbit on trunk and head. Save `thtr-1-regression.png`. Pass when behavior matches and only the intended vocabulary changes.
- [ ] Lane 2. Open `/vibes`. Save `thtr-1-vibes-redirect.png`. Pass when the final URL is `/theaters`.
- [ ] Lane 3. Open `/rooms`. Save `thtr-1-rooms-redirect.png`. Pass when the final URL is `/theaters`.
- [ ] Lane 4. Open Orbit. Save `thtr-1-orbit-vibe.png`. Pass when Vibe and Vibe Match remain visible.
- [ ] Lane 5. Open Hunt. Save `thtr-1-hunt-copy.png`. Pass when no session copy contains vibe or room.
- [ ] Lane 6. Open movie detail. Save `thtr-1-detail-copy.png`. Pass when Similar Films replaces Similar Vibes and Orbit copy is unchanged.
- [ ] Lane 7. Open Library. Save `thtr-1-library-copy.png`. Pass when Theaters appears and Rooms and Vibes do not.
- [ ] Lane 8. Open You. Save `thtr-1-you-copy.png`. Pass when the stat label is THEATERS on one line at 390 px.
- [ ] Lane 9. Repeat Lane 8 at 320 px. Save `thtr-1-you-320.png`. Pass when THEATERS does not wrap or overflow.
- [ ] Lane 10. Trigger the vocabulary script with a seeded violation in a lane worktree. Save `thtr-1-guard-fails.png`. Pass when the command exits 1 and names the violation.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Measure Vite build duration and Hunt-to-results duration on trunk and head. Count Grok requests in the same Hunt flow.
- [ ] Probe. Run five interleaved trunk and head samples with the same mocked TMDB delay and query.
- [ ] Baseline. Record trunk median and p95 first.
- [ ] Rule. Head Hunt-to-results p95 cannot exceed trunk by more than 75 ms. Grok request count must match trunk. Build duration cannot exceed trunk by more than 15%.

**Review gate.** The operator reviews before merge.

- [ ] Copy Lane 4, Lane 7, and Lane 8 screenshots into `artifacts/verify/thtr-1-review-*.png`.
- [ ] Record a 30 to 60 second video of Hunt, Library, You, and Orbit. Save `artifacts/verify/thtr-1-review.mp4`.
- [ ] Post the screenshots and video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict exists at the exact head SHA.
- [ ] Bugbot triage is done.
- [ ] Rebase onto current trunk after the verdict. Preserve the patch-id.
- [ ] Append THTR-1 as the stack root. The operator lands it later.

## Build the Theater domain and one-call inference (THTR-2)

**Depends on.** THTR-1.

**Files.**

- [ ] Create `src/lib/theater/types.ts`, `session.ts`, `gate.ts`, `fingerprint.ts`, `infer.ts`, `persist.ts`, `legacyStore.ts`, and `index.ts`.
- [ ] Create `src/lib/theater/session.test.ts`, `gate.test.ts`, `fingerprint.test.ts`, `infer.test.ts`, `persist.test.ts`, and `legacyStore.test.ts`.
- [ ] Create `src/skills/theater-infer.md`.
- [ ] Edit `src/lib/skills.ts`.

**Build.**

- [ ] Use this state model.

```ts
type TheaterSession =
	| { status: 'idle' }
	| { status: 'collecting'; signals: TheaterSignal[]; lastActiveAt: number }
	| { status: 'inferring'; signals: TheaterSignal[]; revision: number; fingerprint: string; lastActiveAt: number }
	| { status: 'showing'; theater: Theater; signals: TheaterSignal[]; fingerprint: string; lastActiveAt: number }
	| { status: 'kept'; theater: Theater; keptId: string }
	| { status: 'closed'; reason: 'dismissed' | 'idle' | 'signed_out' };

type TheaterSignal =
	| { kind: 'query'; text: string; mode: 'standard' | 'ai-curated'; at: number }
	| { kind: 'detail_view'; film: TheaterFilm; at: number }
	| { kind: 'dwell'; filmId: number; ms: number; engaged: boolean };

type TheaterDraft = {
	title: string;
	facets: [string, string];
	insight: string;
	picks: { title: string; year: string; reason: string }[];
};

type Theater = {
	title: string;
	facets: [string, string];
	insight: string;
	swatches: [string, string, string, string];
	sourceFilmIds: number[];
	lineup: TheaterLineupItem[];
};
```

- [ ] Keep `TheaterDraft` at the Grok boundary. Hydrate and validate it before the reducer receives a `Theater`.
- [ ] Start inference after two unique committed queries, two unique film landings, one query plus one film, or one `ai-curated` query.
- [ ] Wait 2500 ms after the last new unique signal. A query that extends its predecessor by prefix replaces it.
- [ ] Build the fingerprint from normalized committed queries and sorted `mediaType:id` pairs. Presentation fields do not affect identity.
- [ ] Run one `callLlmForJSON` per fingerprint with `reasoningEffort: 'low'` and `maxTokens: 700`. Do not issue a repair call. A malformed response returns to collecting and can retry only after new evidence changes the fingerprint.
- [ ] Reject stale revisions. A late response cannot replace a newer Theater.
- [ ] Preserve each lineup reason through TMDB hydration. Reject a hydrated title that fails `hydratedTitleMatchesPick`.
- [ ] Derive swatches from available poster colors. Fall back to `#1D5B8A`, `#8A3A1D`, `#3A6E85`, and `#1D1D20`.
- [ ] Store collecting, inferring, and showing state in `sessionStorage` under a UID-scoped versioned key. Parse stored JSON at the boundary.
- [ ] Define the canonical `users/{uid}/theaters/{id}` shape. Derive counts from the film list. Do not store `filmCount` or `unseenCount`.
- [ ] Map legacy `saved_vibes` documents into Theaters. Copy each document to `theaters` under the same ID with `setDoc`. Never delete the source document.

**You see.**

- [ ] `npm test -- src/lib/theater` reports the literal session, gate, fingerprint, parser, persistence, and legacy cases as passing.
- [ ] No screen imports the new module in this PR.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Use `Heat` 1995 with ID 949 and `Thief` 1981 with ID 10858 as literal film fixtures.
- [ ] Assert that two queries, two films, one query plus one film, and one AI-curated query enter `inferring`.
- [ ] Assert that one plain query stays `collecting`.
- [ ] Assert that duplicate film landings remain one unique film.
- [ ] Assert that `"heat"` followed by `"heat night"` remains one committed query.
- [ ] Assert the exact fingerprint for one fixed fixture and prove that title casing and year presentation do not change it.
- [ ] Parse a literal draft titled `Men who are good at their jobs and lose anyway` with facets `COMPETENCE PORN` and `NOBODY WINS`.
- [ ] Assert eight hydrated lineup items and each literal reason. Reject missing reasons, duplicate films, mismatched hydrated titles, and malformed JSON.
- [ ] Assert that stale revision 1 cannot replace revision 2.
- [ ] Assert that corrupted storage clears only the Theater key and returns `idle`.
- [ ] Assert that two legacy-copy runs converge on the same IDs and delete nothing.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against THTR-1. Drive Hunt and movie detail on both heads. Save `thtr-2-regression.png`. Pass when product behavior and request counts match.
- [ ] Lane 2. Run the two-query fixture through a browser harness page. Save `thtr-2-two-queries.png`. Pass when status is `inferring`.
- [ ] Lane 3. Run the two-film fixture. Save `thtr-2-two-films.png`. Pass when status is `inferring`.
- [ ] Lane 4. Run the mixed fixture. Save `thtr-2-mixed.png`. Pass when status is `inferring`.
- [ ] Lane 5. Run one AI-curated query. Save `thtr-2-ai-query.png`. Pass when status is `inferring`.
- [ ] Lane 6. Resolve a newer response before an older response. Save `thtr-2-stale.png`. Pass when only the newer title appears.
- [ ] Lane 7. Reload a showing fixture. Save `thtr-2-restore.png`. Pass when the exact Theater returns without a network call.
- [ ] Lane 8. Load malformed storage. Save `thtr-2-corrupt-storage.png`. Pass when status is `idle` and the app stays usable.
- [ ] Lane 9. Seed one legacy document twice. Save `thtr-2-legacy-idempotent.png`. Pass when one canonical document exists and the source remains.
- [ ] Lane 10. Return malformed Grok JSON. Save `thtr-2-malformed.png`. Pass when state returns to collecting and no partial Theater publishes.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Measure reducer plus fingerprint time for 100 signals and storage parse time for a 12-signal session.
- [ ] Probe. Run 1000 interleaved samples on THTR-1 and THTR-2 with the same fixture.
- [ ] Baseline. Record THTR-1's no-op harness cost first.
- [ ] Rule. Reducer plus fingerprint p95 must stay below 5 ms. Storage parse p95 must stay below 3 ms. The module adds zero runtime Grok calls because no screen is wired.

**Review gate.** None. THTR-2 is not review-gated.

**Merge.**

- [ ] Root's clean verdict exists at the exact head SHA.
- [ ] Bugbot triage is done.
- [ ] Rebase onto THTR-1 after the verdict. Preserve the patch-id.
- [ ] Append THTR-2 above THTR-1.

## Wire session signals, persistence, and Keep (THTR-3)

**Depends on.** THTR-2.

**Files.**

- [ ] Edit `src/contexts/TheaterContext.tsx`, `src/screens/DiscoverScreen.tsx`, `src/screens/MovieDetailScreen.tsx`, and `src/hooks/useMovieSearch.ts`.
- [ ] Edit `src/lib/taste/types.ts`, `src/lib/taste/applyEvent.ts`, `src/lib/taste/buildRecommendContext.ts`, and `src/lib/taste/recordTasteEvent.ts`.
- [ ] Edit `src/lib/activityLogger.ts`, `src/lib/analytics.ts`, `firestore.rules`, and `admin-dashboard/pages/2_Activity.py`.
- [ ] Delete the old pattern and show-more prompts from `TheaterContext.tsx`.
- [ ] Delete `generateVibeList` and its old result type from `useMovieSearch.ts`.

**Build.**

- [ ] Make `TheaterContext` a thin owner of `useReducer`, timers, AbortController, `sessionStorage`, auth transitions, and Firestore Keep.
- [ ] Dispatch `query` after a Hunt query has settled through the existing 300 ms search debounce. Do not dispatch keystrokes.
- [ ] Dispatch `detail_view` on movie detail mount from Hunt, Home, Library, the Theater lineup, and shared lists. Deduplicate React Strict Mode mounts by `mediaType:id`.
- [ ] Dispatch `dwell` on detail exit. Mark under 8 seconds without a like, save, or log action as not engaged. Mark 12 seconds or any action as engaged.
- [ ] Do not close the Theater when the person clears Hunt search.
- [ ] Abort an older infer when the fingerprint changes. Ignore a response whose revision is stale.
- [ ] Render the lineup returned by the first infer. Remove the second `showMoreMovies` Grok call.
- [ ] Keep with an idempotent `setDoc` into `users/{uid}/theaters/{fingerprint}`. Store title, facets, insight, swatches, source signals, source films, lineup reasons, schema, and `keptAt`.
- [ ] End the live session after Keep, dismiss, 30 minutes without a new signal, or sign-out. Clear the UID-scoped session key.
- [ ] Write a new `{ type: 'theater', insight, movieIds }` taste event on Keep. Continue reading legacy `{ type: 'pattern' }`.
- [ ] Emit `theater_kept` once on Keep. Continue displaying legacy `vibe_saved` rows in the admin dashboard. Never emit a save action when inference finishes.
- [ ] Add Firestore owner rules for `theaters`. Keep read and write rules for `saved_vibes` during copy-forward.

**You see.**

- [ ] Two queries, two film landings, one query plus one landing, or one AI-curated query produce one Theater after 2500 ms.
- [ ] The first Theater response already contains its lineup and reasons.
- [ ] Refresh restores the live Theater in the same tab. A new tab starts empty.
- [ ] Keep creates one canonical document and ends the live session.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Add reducer integration tests for infer abort, stale result rejection, idle close, sign-out close, and Keep idempotency.
- [ ] Add taste tests that assert both `theater` and legacy `pattern` prepend the literal insight to `generated.patterns`.
- [ ] Add a telemetry test that asserts one `theater_kept` event with no raw query text.
- [ ] Add Firestore emulator tests. A second UID cannot read or write the first UID's Theaters. The owner can read and write both canonical and legacy collections.
- [ ] Run `npm test`, `npm run lint`, and `npm run build`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against THTR-2. Open three films on both heads. Save `thtr-3-regression.png`. Pass when THTR-3 adds the Theater and keeps Hunt and detail usable.
- [ ] Lane 2. Commit two queries without opening a result. Save `thtr-3-queries.png`. Pass when the fixture title and eight reasons appear.
- [ ] Lane 3. Open two films without a query. Save `thtr-3-films.png`. Pass when one Theater appears.
- [ ] Lane 4. Commit one query and open one film. Save `thtr-3-mixed.png`. Pass when one Theater appears.
- [ ] Lane 5. Commit one AI-curated sentence. Save `thtr-3-ai-query.png`. Pass when one Theater appears and the old generated list does not.
- [ ] Lane 6. Clear Hunt search after a detail-built Theater appears. Save `thtr-3-clear.png`. Pass when the Theater remains.
- [ ] Lane 7. Reload the tab. Save `thtr-3-refresh.png`. Pass when the same title, facets, and lineup return with no new Grok call.
- [ ] Lane 8. Open a second tab. Save `thtr-3-new-tab.png`. Pass when the second tab starts with no Theater.
- [ ] Lane 9. Keep twice with the emulator. Save `thtr-3-keep.png`. Pass when one document exists and one `theater_kept` event exists.
- [ ] Lane 10. Return HTTP 500 from `/api/llm`. Save `thtr-3-llm-down.png`. Pass when Hunt and movie detail stay usable and no partial Theater renders.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Count Theater infer requests per fingerprint. Measure signal-to-shell time, mocked-response-to-ready overhead, Hunt-to-results time, and warm-restore time.
- [ ] Probe. Run three warmups and twenty measured samples on THTR-2 and THTR-3 in ABBA order. Fix the infer delay at 600 ms and TMDB hydration at 100 ms.
- [ ] Baseline. Record THTR-2 Hunt-to-results p95 first. Record all THTR-3 absolute metrics.
- [ ] Rule. Use zero calls for transient typing and one call per new fingerprint. Signal-to-shell p95 must stay below 100 ms. Client overhead after the controlled network floor must stay below 250 ms. Warm restore p95 must stay below 150 ms. Hunt-to-results p95 cannot regress by more than 75 ms.

**Review gate.** The operator reviews before merge.

- [ ] Copy Lane 2, Lane 5, Lane 7, and Lane 9 screenshots into `artifacts/verify/thtr-3-review-*.png`.
- [ ] Record a 30 to 60 second video of query, Theater, Keep, and refresh. Save `artifacts/verify/thtr-3-review.mp4`.
- [ ] Post the screenshots and video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict exists at the exact head SHA.
- [ ] Bugbot triage is done.
- [ ] Rebase onto THTR-2 after the verdict. Preserve the patch-id.
- [ ] Append THTR-3 above THTR-2.

## Build the Theater card, archive, Library, and You (THTR-4)

**Depends on.** THTR-3.

**Files.**

- [ ] Edit `src/components/TheaterCard.tsx`, `src/screens/TheatersScreen.tsx`, `src/components/LibraryHub.tsx`, `src/screens/ProfileScreen.tsx`, and `src/hooks/useUserInsights.ts`.
- [ ] Create `src/components/ui/SwatchStrip.tsx`.
- [ ] Edit `e2e/flows.spec.ts`.
- [ ] Create `.cursor/skills/verify-selects/features/F15-theater.md`.
- [ ] Edit `.cursor/skills/verify-selects/features/F10-library.md` and `F11-you.md`.

**Build.**

- [ ] Match the 390 by 844 Figma frame. Use a 28 px horizontal inset.
- [ ] Render kept Theater cards at 334 by 190. Use Surface/raised, a 1 px inside Surface/line stroke, radius 0, and clipped content.
- [ ] Render the title in display type. Clamp it to two lines.
- [ ] Render exactly two facets in Martian Mono, Accent/select, and uppercase. Join them with ` × `. Give the separator an `aria-hidden` attribute and add screen-reader text that says "and".
- [ ] Render four square swatches. Hide them from the accessibility tree.
- [ ] Render the count line as `<films> FILMS · <unseen> UNSEEN`. Derive both counts. Use Text/secondary instead of Text/tertiary on Surface/raised to meet AA contrast.
- [ ] Use the archive kicker `THEATERS`, subcopy `FACETS YOU KEPT WALKING BACK INTO`, and footer `A THEATER IS WHAT A TRAIL BECOMES WHEN YOU KEEP IT`.
- [ ] Replace the six Library rows with five. Keep Watched, The Wallet, Saved, Theaters, and Shared lists in that order. Remove the old Rooms and Vibes rows.
- [ ] Use live counts. Do not render the Figma's static `581 HOURS` because runtime is not stored in `LibraryFilm`.
- [ ] Show four You stats. Use WATCHED, WALLET, THEATERS, and THIS YEAR. Keep THEATERS on one line at 320 px.
- [ ] Add accessible names and 44 px minimum touch targets. Keep the Theater card one button with a full title, facets, film count, and unseen count in its label.
- [ ] Keep `/watchlist` routable for Saved, Wallet, and personal-list back links even though Library no longer shows a Rooms row.

**You see.**

- [ ] Hunt and movie detail use the square Theater card style.
- [ ] `/theaters` matches the verified Figma archive anatomy.
- [ ] Library has five rows with Theaters in the fourth position.
- [ ] You shows the live Theater count.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Add pure renderer-model tests. A canonical document produces two facets, four swatches, and literal counts. A legacy document uses its pattern as the title and hides missing facets without throwing.
- [ ] Add plural tests for `1 FILM`, `2 FILMS`, `1 UNSEEN`, and `2 UNSEEN`.
- [ ] Add a contrast test for every text-token and background-token pair used by the cards and rows.
- [ ] Run `npm test`, `npm run lint`, and `npm run build`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against THTR-3. Run the same query, Theater, Keep, and archive flow. Save `thtr-4-regression.png`. Pass when behavior matches and the new chrome contains the same data.
- [ ] Lane 2. Open a live Theater on Hunt at 390 px. Save `thtr-4-hunt-card.png`. Pass when no purple or rounded legacy chrome remains.
- [ ] Lane 3. Open the compact Theater on movie detail. Save `thtr-4-detail-card.png`. Pass when the title, facets, and one reason are readable.
- [ ] Lane 4. Keep the literal fixture and open `/theaters`. Save `thtr-4-archive.png`. Pass when the 334 by 190 card shows title, facets, four swatches, and counts.
- [ ] Lane 5. Seed a legacy document. Save `thtr-4-legacy.png`. Pass when the title renders, the facet line hides, and no exception occurs.
- [ ] Lane 6. Open Library. Save `thtr-4-library.png`. Pass when five rows render in the Figma order and Theaters routes to `/theaters`.
- [ ] Lane 7. Open You at 390 px. Save `thtr-4-you.png`. Pass when all four stats render and THEATERS stays on one line.
- [ ] Lane 8. Repeat Lane 7 at 320 px. Save `thtr-4-you-320.png`. Pass when the stats do not overlap or overflow.
- [ ] Lane 9. Run keyboard-only navigation through Library and the archive. Save `thtr-4-keyboard.png`. Pass when focus order matches visual order and every target has a visible focus state.
- [ ] Lane 10. Run the accessibility and horizontal-overflow thresholds on mobile and desktop. Save `thtr-4-thresholds.png`. Pass when there are no missing names, undersized targets, or horizontal overflow.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Measure archive first-contentful card, Library first row, and You stats render time on THTR-3 and THTR-4 with the same emulator fixtures.
- [ ] Probe. Run five interleaved samples at mobile and desktop widths.
- [ ] Baseline. Record THTR-3 p95 for each surface first.
- [ ] Rule. THTR-4 p95 cannot regress by more than 100 ms. Archive layout shift must stay below 0.05. The archive must issue zero Grok calls.

**Review gate.** The operator reviews before merge.

- [ ] Copy Lane 2, Lane 4, Lane 6, Lane 7, and Lane 8 screenshots into `artifacts/verify/thtr-4-review-*.png`.
- [ ] Record a 30 to 60 second video of Hunt, Keep, Library, archive, and You. Save `artifacts/verify/thtr-4-review.mp4`.
- [ ] Post the screenshots and video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict exists at the exact head SHA.
- [ ] Bugbot triage is done.
- [ ] Rebase onto THTR-3 after the verdict. Preserve the patch-id.
- [ ] Append THTR-4 above THTR-3.

## Add film axes and Theater reasons to movie detail (THTR-5)

**Depends on.** THTR-4.

**Files.**

- [ ] Edit `src/screens/MovieDetailScreen.tsx`.
- [ ] Create `src/components/ui/AxisMeter.tsx`, `src/hooks/useFilmAxes.ts`, `src/lib/theater/filmAxes.ts`, and `src/lib/theater/filmAxes.test.ts`.
- [ ] Create `src/skills/film-axes.md`.
- [ ] Edit `src/lib/skills.ts` and `firestore.rules`.
- [ ] Edit `.cursor/skills/verify-selects/features/F13-movie-detail.md`.

**Build.**

- [ ] Add the AXES section after the film credits and before the Orbit button.
- [ ] Render the header `AXES` on the left and `THE FILM / YOUR MAP` on the right.
- [ ] Render rows in this order. LOOK, CAMERA, TEMPO, WEATHER, SOUND, WORLD, SHAPE, FORMAT.
- [ ] Give each row a facet value, five slanted `BarUnit` marks, and the person's matching-film count.
- [ ] Parse one model result at the boundary. Cache film-level axes under `film_axes/{mediaType}:{id}`. Permit authenticated reads and create-only writes.
- [ ] Compute YOUR MAP counts from kept Theater facets. Do not ask Grok for user counts.
- [ ] Restyle the existing Orbit CTA as the full-width light button in the Figma frame. Keep `data-testid="orbit-cta"`.
- [ ] Below the button, show the current Theater title as the section kicker when the film belongs to a kept Theater.
- [ ] Show title, year, swatch, and the stored per-film reason. Hide the section when no Theater contains the film.
- [ ] Use the literal fixture reasons from the Figma evidence for Le Samouraï 1967, To Live and Die in L.A. 1985, and Collateral 2004.

**You see.**

- [ ] A film page shows all eight AXES rows, the Orbit CTA, and a reason list from a kept Theater.
- [ ] A second visit reads the cached film axes without a Grok call.
- [ ] A film outside every kept Theater hides the reason section.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Parse a literal axis fixture with `sodium-and-cyan night`, `locked-off`, `procedural`, `competence porn`, `synth pulse`, `rain-slick city night`, `two-hander`, and `1.85 spherical`.
- [ ] Assert each five-bar score and literal count.
- [ ] Reject missing rows, out-of-range scores, duplicate axis names, and malformed cache data.
- [ ] Assert that a second cache write cannot update an existing document.
- [ ] Add Firestore emulator tests for authenticated read, authenticated create, and denied update or delete.
- [ ] Run `npm test`, `npm run lint`, and `npm run build`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against THTR-4. Open the same film on both heads. Save `thtr-5-regression.png`. Pass when existing credits, actions, similar films, and Orbit navigation still work.
- [ ] Lane 2. Open Thief with no cache. Save `thtr-5-axes-first.png`. Pass when all eight rows render in the required order.
- [ ] Lane 3. Reload Thief. Save `thtr-5-axes-cache.png`. Pass when the same rows render with no Grok request.
- [ ] Lane 4. Open Thief with a kept Theater. Save `thtr-5-reasons.png`. Pass when the Theater title and three literal film reasons render.
- [ ] Lane 5. Open a film outside every Theater. Save `thtr-5-no-reasons.png`. Pass when the reason section is absent.
- [ ] Lane 6. Open the Orbit CTA. Save `thtr-5-orbit.png`. Pass when navigation reaches `/orbit/:id`.
- [ ] Lane 7. Open at 390 px. Save `thtr-5-mobile.png`. Pass when labels, values, meters, and counts do not overlap.
- [ ] Lane 8. Open at 320 px. Save `thtr-5-mobile-320.png`. Pass when the eight rows stay readable without horizontal scrolling.
- [ ] Lane 9. Navigate the section with a screen reader tree snapshot. Save `thtr-5-a11y.png`. Pass when each meter has an axis name and score.
- [ ] Lane 10. Deny the film-axes create in the emulator. Save `thtr-5-cache-denied.png`. Pass when the generated axes still render for the current visit and the rest of the page stays usable.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Measure movie-heading time, axes-shell time, uncached axes-ready overhead, cached axes-ready time, and Grok calls.
- [ ] Probe. Run three warmups and twenty samples on THTR-4 and THTR-5 in ABBA order. Fix the model delay at 600 ms.
- [ ] Baseline. Record THTR-4 movie-heading p95 first. Record THTR-5 absolute axes metrics.
- [ ] Rule. Movie-heading p95 cannot regress by more than 75 ms. Axes shell p95 must stay below 100 ms. Client overhead after the model response must stay below 150 ms. Cached axes must render within 150 ms with zero Grok calls.

**Review gate.** The operator reviews before merge.

- [ ] Copy Lane 2, Lane 3, Lane 4, and Lane 8 screenshots into `artifacts/verify/thtr-5-review-*.png`.
- [ ] Record a 30 to 60 second video of uncached axes, cached reload, reasons, and Orbit navigation. Save `artifacts/verify/thtr-5-review.mp4`.
- [ ] Post the screenshots and video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict exists at the exact head SHA.
- [ ] Bugbot triage is done.
- [ ] Rebase onto THTR-4 after the verdict. Preserve the patch-id.
- [ ] Append THTR-5 as the stack tip.

## Close the program

- [x] Product, unit, live, and performance evidence for THTR-1 through THTR-5 is recorded in `docs/theater-verification-receipt.md` at tip `brranchhtheater-film-detail-7375`.
- [x] Reply to the operator with the root and tip PR links, one verdict line per PR, every review artifact, the final vocabulary output, and any excluded work with its reason.

## Appendix A. Prototype evidence

The existing Figma file settled the product layout before this plan.

- `artifacts/figma/theaters-frame-after.png` proves the archive header, three-card anatomy, and footer copy.
- `artifacts/figma/library-after.png` proves the five Library rows and their order.
- `artifacts/figma/you-after.png` and `artifacts/figma/you-stats-layer-renamed.png` prove the THEATERS stat.
- `artifacts/figma/film-axes-table.png` proves the AXES row order and literal facet values.
- `artifacts/figma/film-page-header-after.png` and `artifacts/figma/film-theaters-section.png` prove the per-film reason layout.
- `artifacts/figma/variables.png`, `variables-space.png`, `variables-type.png`, and `text-styles.png` prove the token values in THTR-1.
- `artifacts/figma/facet-separator.png` proves the `×` facet separator and `·` count separator.
- `artifacts/figma/swatch-geometry.png` proves the 334 by 190 card, raised fill, line stroke, square corners, and clipped content.

The Figma exploration was browser-driven and has no code SHA. The source file remains the design authority. The plan treats measured gaps and text-role assignments as implementation choices to verify in THTR-4.

## Appendix B. Alternatives rejected

**Rename the current context and keep its shape.** Rejected. `clickedMovies`, `patternInsight`, `vibeSaved`, and request refs cannot represent collecting, inferring, showing, kept, and closed without synchronized booleans.

**Keep `generateVibeList` next to Theater.** Rejected. Both features would use the same Hunt evidence to create competing personalized lists. Theater owns the lineup.

**Keep both `useExploration` and `useTheater`.** Rejected. Two names would preserve the old API and force every caller to understand the migration.

**Write live sessions to Firestore.** Rejected. A live Theater belongs to one browser tab. `sessionStorage` provides that scope without durable writes.

**Delete legacy `saved_vibes` after migration.** Rejected. Copy-forward with stable IDs converges after retries and preserves rollback data.

**Use `localStorage` for live state.** Rejected. A second tab would inherit a session that it did not create.

**Store film and unseen counts.** Rejected. Both values derive from the lineup and the film ledger. Stored counts can drift.

**Rename every English use of room.** Rejected. "Cutting room", "across the room", and "the room and the projection" do not name this feature.

## Appendix C. Risks

**React Strict Mode duplicates effects.** THTR-2 fingerprints unique film identities. THTR-3 guards detail mounts by `mediaType:id`.

**A stale model response can replace newer evidence.** THTR-2 carries a revision. THTR-3 aborts older work and checks the revision again before publish.

**Malformed model output can publish partial UI.** THTR-2 parses the complete draft at the boundary. It publishes no Theater unless every required field passes.

**The card can clip long copy.** THTR-4 clamps titles to two lines and limits model facets. The detail view holds full copy.

**Tertiary text misses AA on raised surfaces.** THTR-4 uses Text/secondary for functional card and row metadata.

**The Figma Library removes the old Rooms entry.** THTR-4 keeps `/watchlist` reachable from Saved, Wallet, and existing personal-list links.

**The e2e suite can touch live Firebase.** THTR-3 through THTR-5 use Firebase emulators for every write lane.

**The local Vite proxy points at production API functions.** Live lanes mock `/api/llm` unless they explicitly test the model boundary.

**Dependencies may be absent in a fresh VM.** Each boot recipe waits for the environment install before running checks.

## Appendix D. Links and reading list

- `src/contexts/ExplorationContext.tsx` owns the current session and two Grok calls.
- `src/screens/DiscoverScreen.tsx` owns the 300 ms Hunt debounce and the current panel.
- `src/screens/MovieDetailScreen.tsx` records detail views and mounts the compact panel.
- `src/hooks/useMovieSearch.ts` owns `classifyQuery` and the list that THTR-3 removes.
- `src/lib/llm.ts` owns cached text and JSON calls.
- `src/lib/orbitEngine.ts` proves low-reasoning JSON calls and keeps Orbit's vibe wording.
- `src/lib/taste/parseSelectPicks.ts` and `selectPickCoherence.ts` provide the per-film reason and hydration patterns.
- `src/lib/library/ledger.ts` provides the Firestore boundary-parser pattern.
- `e2e/orbit-performance.spec.ts` provides the request-count and timing-artifact pattern.
- `.cursor/skills/verify-selects/SKILL.md` defines repository verification evidence.
- THTR-2 and THTR-3 run `pstack/skills/how/SKILL.md` and `pstack/skills/architect/SKILL.md` before implementation.
- THTR-3 and THTR-5 run `pstack/skills/interrogate/SKILL.md` before review because they change the AI and persistence boundaries.
- Each owner keeps an uncommitted decision trail per `pstack/skills/show-me-your-work/SKILL.md`.

## Appendix E. Principles that changed the plan

**Model the Domain.** This principle replaced the context's synchronized booleans with the `TheaterSession` status union and typed signals.

**Redesign from First Principles.** This principle moved Hunt queries into the session model and collapsed pattern detection and Show me more into one JSON result.

**Subtract Before You Add.** This principle deletes `generateVibeList`, the second Show me more model call, the orphaned profile dropdown, and the old context API before new UI grows.

**Build the Lever.** This principle adds one rerunnable vocabulary codemod and check instead of a hand-edited rename.

**Sequence Work into Verifiable Units.** This principle orders vocabulary, domain, wiring, product chrome, and film detail as a linear stack. Each PR ends in its own checks.

**Test Behavior, Not Implementation.** This principle requires literal reducer outputs, rendered copy, persisted documents, reasons, and request counts. A mock-call assertion cannot pass alone.

**Prove It Works.** This principle requires browser evidence, trunk comparisons, seeded guard failures, and measured performance limits in addition to tests.

**Technical writing and Unslop.** These skills keep the plan as a how-to with concrete paths, commands, outputs, and short sentences.
