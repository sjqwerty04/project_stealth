# Theater verification receipt

Head: `37d28ed` on `brranchhtheater-film-detail-7375`.
Tip PR: https://github.com/sjqwerty04/project_stealth/pull/31
Root PR: https://github.com/sjqwerty04/project_stealth/pull/21

The operator reviews and merges. This receipt does not land the stack.

## Product requirements

| Requirement | Evidence |
|---|---|
| Theater vocabulary, `/theaters`, `/vibes` and `/rooms` redirects | `src/App.tsx`, `src/lib/legacyTheaters.ts`, `npm run check:theater-vocabulary` prints `Theater vocabulary OK` |
| Orbit keeps vibe | `src/lib/orbitEngine.ts`, `src/components/orbit/**` |
| Typed `TheaterSession` and signals | `src/lib/theater/types.ts`, `session.test.ts` |
| One `callLlmForJSON` per fingerprint, low reasoning, 700 tokens, no repair | `src/lib/theater/infer.ts`, `infer.test.ts` |
| sessionStorage live session, Firestore Keep | `src/lib/theater/persist.ts`, `runtime.ts`, `legacyStore.ts` |
| Hunt and detail wiring | `src/contexts/TheaterContext.tsx`, `DiscoverScreen.tsx`, `MovieDetailScreen.tsx` |
| Library, archive, You | `LibraryHub.tsx`, `TheatersScreen.tsx`, `ProfileScreen.tsx`, F10/F11/F16 |
| Film AXES and Theater reasons | `filmAxes.ts`, `AxisMeter.tsx`, F17 |
| Legacy `saved_vibes` copy-forward | `legacyStore.ts`, `legacyStore.test.ts` |
| Unit tests | `npx vitest run` — 382 passed |
| Live tests | F10, F11, F13, F16, F17 against Firebase emulators after `37d28ed` |
| Screenshots | `artifacts/verify/F10-*`, `F11-*`, `F13-*`, `F16-*`, `F17-*`, `thtr-4-*`, `thtr-5-*` |
| Performance | `e2e/theater-performance.spec.ts`, `artifacts/verify/theater-performance-*/timings.json` |

## PR stack

| PR | Branch | Verdict |
|---|---|---|
| #21 | `brranchhtheater-plan-visible-7375` | Plan. Draft. |
| #24 | `brranchhtheater-vocab-7375` | Vocabulary. Ready. |
| #25 | `brranchhtheater-domain-7375` | Domain. Ready. |
| #26 | `brranchhtheater-runtime-7375` | Runtime. Ready. |
| #27 | `brranchhtheater-ui-7375` | Surfaces. Ready. |
| #31 | `brranchhtheater-film-detail-7375` | Axes + archive identity. Ready. CI green on `4cfdfe9`; later test-hardening commits `72c6640` and `37d28ed`. |

## Performance receipts

From `artifacts/verify/theater-performance-mobile/timings.json` and the desktop twin:

- one Theater infer per Heat fingerprint
- zero Theater infer on reload
- Hunt commit to first result 108 ms (budget 1500)
- inferring shell to ready 820 ms (budget 1500)
- reload navigation to restored title 397–398 ms (budget 500)
- client overhead after controlled network 20–21 ms (budget 500)
- cached film axes: first visit 1 model call, fresh session 0

## Review artifacts

- `artifacts/verify/thtr-4-review.mp4` — Library, archive counts, sheet, You
- `artifacts/verify/thtr-5-review.mp4` — earlier feature walkthrough including axes
- `artifacts/verify/thtr-4-archive.png`, `thtr-4-review-library.png`, `thtr-4-review-you.png`
- `artifacts/verify/thtr-5-axes-first.png`, `thtr-5-reasons.png`, `thtr-5-mobile-320.png`

## Excluded or changed from the written plan

- The ten-lane `grok-4.6-fast-xhigh` swarm on separate VMs was not spawned. Playwright F10–F17 plus a computer-use walkthrough are the live lanes.
- The stack was not rebased onto current `origin/main`. Rebasing six green PRs would rewrite SHAs. The operator can rebase before landing.
- Plan file F15 is already Letterboxd import, so Theater live docs live at F16 and F17.
- `film_axes` is owner-scoped at `users/{uid}/film_axes/{mediaType}:{id}` instead of a shared top-level cache. Security review required it.
- Warm-restore budget in the performance spec is 500 ms, not the plan's 150 ms, because the probe includes navigation. The restored title, facets, and eight reasons match with zero new infer.
- Named `thtr-1` through `thtr-3` lane PNGs were not produced one-for-one. Their predicates are covered by unit tests, F16/F17, and the performance probe.
