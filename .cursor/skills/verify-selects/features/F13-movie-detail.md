# F13 Movie detail

The film page. `artifacts/figma/film-axes-table.png` is the design authority for the AXES table, `artifacts/figma/film-theaters-section.png` for the reason rows, and `artifacts/figma/film-page-thief-bottom.png` for the order of the lower page.

`/movie/:id?type=movie|tv` renders, in order: backdrop and title block, `RatingBadges`, `MovieActions`, the known-for read at `why-you-would-like-this`, Synopsis, Cast, AXES, the Orbit CTA, the kept-Theater reasons, the compact Theater card, then Similar Films.

## AXES

`src/lib/theater/filmAxes.ts` owns the model. Eight axes, always in this order: LOOK, CAMERA, TEMPO, WEATHER, SOUND, WORLD, SHAPE, FORMAT. `FilmAxes` is an eight-slot tuple typed slot by slot, so a reordered or short table does not compile.

- The header is `AXES` on the left and `THE FILM / YOUR MAP` on the right, the slash in Surface/line.
- A row is `axis-row`: a Martian Mono label in Text/tertiary at Label 10, the value in Martian Mono at 12 in Text/primary, five slanted marks, and the count right aligned on tabular figures. Rules are 1 px Surface/line, radius 0 throughout.
- The model supplies `value` and `score` only. The count is the person's own data and never comes back from Grok.
- `deriveUserAxisRows` is the one counting rule. `theaterEvidenceByFilm` pools everything the kept Theaters say about a film — their titles, their facets, and that film's stored reason — into one text per distinct film, so a film kept in two Theaters counts once. `theaterFilmMatchesAxisValue` then decides a single row: the film meets the axis when the two texts share a significant word. Words shorter than three letters and a fixed stopword list drop out, so `two-hander` does not meet a reason that merely says `TWO`.

## The axes boundary

- `parseFilmAxes` is the sole constructor for `FilmAxes` and runs on both the model reply and the cached document. A missing, duplicated, unknown, reordered, blank, or out-of-range row returns `null` and the section stays hidden.
- Each person caches their own reading at `users/{uid}/film_axes/{mediaType}:{id}`, holding `schema`, the film identity, the axes, and `createdAt`. Ownership is the path, so no document carries an author field. Only that person may read or create it, and update and delete are denied to everyone, which leaves nobody a way to edit what another person will read.
- The rule checks the document it is handed: exactly those seven fields, `schema` 1, a `movie` or `tv` string, an integer `filmId`, a path key that is `mediaType + ':' + filmId`, a title of 1 to 200 characters, a year of at most 16, and eight axes. Each axis holds only `name`, `value`, and `score`, names the axis its position expects, carries a value of 1 to 80 characters, and scores 1 through 5. A document cannot be filed under a film it does not name.
- `parseCachedFilmAxes` re-checks that identity on the way in, so a document that names another film is refused by the reader as well as by the rule.
- `MAX_AXIS_VALUE_LENGTH`, `MAX_CACHED_TITLE_LENGTH`, and `MAX_CACHED_YEAR_LENGTH` are the three lengths, and a unit test reads `firestore.rules` to prove the rule spends the same numbers. The parser refuses an over-long value or title, `filmAxesDocFrom` files a long title and year at the limit while the visit keeps the full title on screen, and `loadFilmAxes` offers the cache nothing the reader would refuse, so a film with no title is shown rather than written.
- `useFilmAxes` reads the cache first and calls Grok only on a miss: one call, `reasoningEffort` low, `maxTokens` 500, zero repair retries. A cache hit makes no call at all.
- A refused cache create is not an error the person sees. `loadFilmAxes` returns the axes it just generated and logs the refusal.
- Every result carries the `filmKey` it was asked for. Navigating to another film shows loading rather than the previous film's table.
- `AxisMeter` is the reusable part: `role="img"`, `aria-label` like `4 of 5`, and exactly five `bar-unit` children whatever the score.

## The Orbit CTA

`Open in Orbit`, full width, Text/primary fill, Surface/base label, square corners, 56 px tall, directly under the table. `orbit-cta` and the route to `/orbit/:id` are unchanged. `Ask AI` sits below it on its own row and opens the chat sheet.

## Kept-Theater reasons

Under the CTA, `film-theater-reasons` speaks from the newest kept Theater that holds this film. `filmTheaterSection` picks it.

- `film-theater-kicker` is the Theater title uppercased.
- Each `theater-reason-row` carries a square swatch cycled from the Theater's four, the title and year, and that film's stored reason in Martian Mono uppercase at Label 10 in Text/tertiary. Rows clear 44 px and route to the film.
- The current film never appears in its own list, and a Theater holding nothing else produces no section.
- A legacy Theater carries blank reasons, so the row renders its title alone rather than an empty line.
- No kept Theater holds the film, so the whole section is absent rather than empty.

## Narrow widths

At 320 px the value wraps to a second line and the label, marks, and count keep their widths. The document does not scroll sideways. The count sits flush with the section's right edge, which is where the Figma frame puts it.

## Evidence

- `e2e/flows.spec.ts` test `F13 Movie detail chrome` asserts the eight rows and their values, the first meter's `aria-label`, the full-width CTA, the absent reason section, and the compact Theater card.
- `e2e/flows.spec.ts` test `F17 Film axes first visit` clears one deterministic fixture document through the Firestore emulator REST API, then asserts exactly one Grok call, the eight names and values, five bars per row, the hidden reason section for a film no Theater holds, and no sideways scroll at 320 px. `clearFilmAxesFixtures` refuses to delete anything unless `VITE_FIREBASE_EMULATOR` is set or the base URL is loopback, and it refuses outright when the emulator host is not loopback.
- `e2e/flows.spec.ts` test `F17 Film axes cache hit and Theater reasons` opens the same film in the next test's own browser context, where the prompt cache in `src/lib/llm.ts` is empty, so the eight rows with zero Grok calls can only have come from Firestore. It then asserts the kicker, the literal reasons, and the excluded current film on a film a Theater does hold.
- `e2e/flows.spec.ts` test `F17 Film axes cache rules` drives the emulator's REST API as two signed-in people and proves the ownership boundary. See `F17-film-axes.md`.
- `e2e/theater-performance.spec.ts` test `Film axes cost one model call on a first visit and none in a fresh session` closes the first context and signs in again in a second one, so the zero calls it records come from the person's own cached document rather than from browser state. It writes `artifacts/verify/theater-performance-<project>/film-axes-cache.json`.
- `artifacts/verify/F13-mobile/`, `artifacts/verify/F17-mobile/`, and `artifacts/verify/F17-desktop/`, including `axes.png`, `axes-320.png`, `theater-reasons.png`, and `thresholds.json`.
- `src/lib/theater/filmAxes.test.ts` pins the Thief fixture, every parser rejection, the document round trip, the refusal of a document filed under another film, the prompt, the call parameters, the word-overlap rule and the counts it produces, the cache hit, the one-call miss, and the refused write that still shows its axes.
- `src/lib/theater/archive.test.ts` pins `filmTheaterSection`: the newest Theater wins, the current film leaves the list, the swatches cycle, and a Theater holding only this film returns nothing.
