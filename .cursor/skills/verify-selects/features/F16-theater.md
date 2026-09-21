# F16 Theater

A Theater is the compact card a live trail produces after three opened films, and the archive row a Save leaves behind.

Numbered F16 because F15 already belongs to the Letterboxd export-import flow in `e2e/flows.spec.ts`.

## The card

`src/components/TheaterCard.tsx` is the same compact card on Hunt and on a film page. Hunt passes `compact`. The card never renders an eight-row lineup, facets, or swatches.

- Surface/raised fill, a 1 px Surface/line stroke, radius 0.
- Left kicker `TREND FOUND`. Right kicker `Your Theater` plus an `i` control.
- `i` opens static copy from `THEATER_INFO`. That text is not model output.
- `status="inferring"` shows the chase loader and `Reading your trail`. No Save, no See more.
- `status="showing"` shows trail posters (cap 6, `+N` if longer), the insight, `Save Theater`, and `See more`.
- `status="kept"` swaps Save to a disabled `Saved`.
- Close sits top right at 44 × 44 with `aria-label="Close Theater"`.
- Testids: `theater-card`, `theater-inferring`, `theater-keep`, `theater-trail`, `theater-info`, `theater-info-copy`, `theater-see-more`.

See more opens `theater-session-sheet`: the insight, every opened trail film, and the handful of recommended posters from the same infer. Save stays available until kept.

## The archive

`/theaters` renders `useTheaters()`, a live `onSnapshot` on `users/{uid}/theaters` ordered by `keptAt` descending. Every document goes through `parseTheaterDoc`.

- 390 px reference frame, 28 px inset, kicker `THEATERS` as the `h1`, subcopy `PATTERNS YOU KEPT WALKING BACK INTO`, footer `A THEATER IS WHAT A TRAIL BECOMES WHEN YOU KEEP IT`.
- The footer is `theater-archive-footer` at Label 10 in Martian Mono. At 28 px inset the run through `KEEP` stays on one line.
- Cards are `data-testid="theater-archive-card"`. Title plus trail posters (first 6 and `+N`), no swatches.
- Trail posters come from opened films on `sourceSignals`. If a legacy document has no signals, the stored film list is the trail.
- `filmCount` / `unseenCount` derive from those trail ids against `watchedFilmIds(films)`.
- `theaterArchiveState` is the one state machine over two live sources. No card renders until both the archive snapshot and `useLibrary` have landed.
- Tapping a card opens `theater-sheet` with the insight, the opened trail, and recommended posters. A row routes to `/movie/<id>?type=<mediaType>`. Close is `aria-label="Close Theater"`.
- Empty state is `theaters-empty` with `START HUNTING` to `/discover`. A snapshot failure is `theaters-error`.

## Swatches

Swatches are no longer live UI. `theaterInference` still samples posters so a stored document keeps a palette, and `F16 Theater poster swatches` still pins the sampler. The compact card and archive cards do not render `SwatchStrip`.

## Legacy documents

A copied-forward `saved_vibes` document names itself with `pattern`, carries `facets: null`, blank per-film reasons, and `FALLBACK_SWATCHES`. It renders on purpose: title plus whatever films it stored as the trail.

## Accessibility

- The card's accessible name is the title and counts. `Men who are good at their jobs and lose anyway. 3 films, 3 unseen.`
- Colour is never the only carrier of a fact.

## Reachability

- `library-row-theaters` routes to `/theaters`. See F10.
- The `THEATERS` stat on `/me` is `useTheaters().theaters.length`. See F11.

## Ownership

The canonical Theater lives at `users/{uid}/theaters/{id}`. The owner may create, read, update, and delete their own. Nobody unauthenticated may read or write one, and a second signed-in person may not read, write, or delete another person's.

## Performance verification

`e2e/theater-performance.spec.ts` measures Hunt commit-to-result, inferring-shell-to-ready after the third film, and reload restore. Hunt plus one film must not infer. Six picks hydrate in parallel. The compact Hunt overlay is a card, not a scroll of eight rows.

## Evidence

- `e2e/flows.spec.ts` test `F16 Theater archive` seeds a live Theater, opens info and see more, saves it, walks Library to `/theaters`, asserts trail posters, the sheet, and the matching `/me` count.
- `e2e/flows.spec.ts` test `F13 Movie detail chrome` asserts the compact card under Synopsis.
- `e2e/flows.spec.ts` test `F16 Theater poster swatches` runs the production sampler.
- `e2e/flows.spec.ts` test `F16 Theater ownership rules` drives the emulator REST API.
- `src/lib/theater/archive.test.ts` pins trail-from-signals, fallback to the stored film list, derived unseen, and both accessible-name shapes.
