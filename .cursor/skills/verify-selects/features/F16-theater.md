# F16 Theater

A Theater is the card a live trail produces and the archive row a Keep leaves behind. `artifacts/figma/theaters-frame-after.png` is the design authority for the archive, `artifacts/figma/swatch-geometry.png` for the strip, and `artifacts/figma/facet-separator.png` for the `×`.

Numbered F16 because F15 already belongs to the Letterboxd export-import flow in `e2e/flows.spec.ts`.

## The card

`src/components/TheaterCard.tsx` renders both the full card in the hunt and the compact card on a film page. `compact` only changes paddings, the title size, and the swatch size. Nothing else forks.

- Surface/raised fill, a 1 px Surface/line stroke, radius 0, and a Martian Mono `Theater` kicker in Text/secondary.
- `status="inferring"` shows the chase loader and `Reading your trail`. No title, no facets, no Keep.
- `status="showing"` shows the title in Archivo, the two facets in Accent/select joined by `×`, the insight in Text/secondary, four square swatches, a full-width `Keep Theater`, and the lineup with every film's reason.
- `status="kept"` swaps the button to a disabled `Kept` on Surface/card. No green, no confetti, no Sparkles.
- Close sits top right at 44 × 44 with `aria-label="Close Theater"`. Keep and every lineup row clear 44 px.
- Testids: `theater-card`, `theater-inferring`, `theater-keep`, `theater-lineup`, plus `facet-line` and `swatch-strip` from the shared parts.

## The archive

`/theaters` renders `useTheaters()`, a live `onSnapshot` on `users/{uid}/theaters` ordered by `keptAt` descending. Every document goes through `parseTheaterDoc`, so the screen holds `KeptTheater` values and never a `DocumentData` or a raw timestamp.

- 390 px reference frame, 28 px inset, kicker `THEATERS` as the `h1`, subcopy `FACETS YOU KEPT WALKING BACK INTO`, footer `A THEATER IS WHAT A TRAIL BECOMES WHEN YOU KEEP IT`.
- The footer is `theater-archive-footer` at Label 10 in Martian Mono with the Label token's own letter-spacing, so it breaks after `KEEP` and not before. At 28 px inset the run through `KEEP` measures 329 px in the 334 px box. Any added tracking from `0.025em` up pushes `YOU KEEP` onto the second line.
- Cards are `data-testid="theater-archive-card"`, 334 × 190 at 390 width, Surface/raised fill, 1 px Surface/line stroke, radius 0. Height is fixed, so a long title clamps at two lines.
- Each card carries the title, the uppercase facets joined by `×`, four square swatches, and `<n> FILMS · <m> UNSEEN` in Text/secondary at `theater-card-counts`.
- Both counts derive at render. `filmCount` is the distinct film ids in the lineup. `unseenCount` is the ones absent from `watchedFilmIds(films)`, the canonical ledger, not a stored number.
- `theaterArchiveState` is the one state machine over two live sources. A half-loaded ledger would make `unseenCount` too high, so the archive snapshot and `useLibrary` share a single loading state and no card renders until both have landed. A snapshot failure outranks either loading state.
- Tapping a card opens `theater-sheet` with the insight and the full lineup. A lineup row routes to `/movie/<id>?type=<mediaType>`. Close is `aria-label="Close Theater"`.
- Empty state is `theaters-empty` with `START HUNTING` to `/discover`. A snapshot failure is `theaters-error`.

## Swatches

A live Theater colours its strip from its own lineup. `theaterInference` hands `inferTheater` the poster sampler, and `posterColorsFrom` samples up to four hydrated lineup posters at `https://image.tmdb.org/t/p/w92`.

- `dominantPosterColor` is the whole aggregation and it is pure. Opaque mid-tone pixels fall into a coarse 8 × 8 × 8 colour grid, the fullest cell wins, and its mean is that poster's colour. Transparent pixels, black bars, and blown-out white drop out. A tie goes to the lower cell, so the same poster always reads the same way.
- `imagePosterSampler` is the only browser part: one `Image` at `crossOrigin="anonymous"`, a 16 px canvas, and `getImageData`. TMDB serves posters with `access-control-allow-origin: *`, so the canvas stays clean. A CORS refusal, a failed load, a missing 2D context, or a poster that answers nothing worth sampling all contribute no colour, and a poster that never answers gives up its turn after `POSTER_LOAD_TIMEOUT_MS`, because swatches are decorative and must not hold the Theater reveal.
- `swatchesFrom` then fills what the posters left from `FALLBACK_SWATCHES`, so a strip is always four valid six-digit hex values. Off a browser there is no sampler and every Theater keeps the verified fallback palette.

## Legacy documents

A copied-forward `saved_vibes` document names itself with `pattern`, carries `facets: null`, blank per-film reasons, and `FALLBACK_SWATCHES`. It renders on purpose.

- The title falls back to the pattern. The facet line is absent, not empty.
- The fallback swatches still draw four squares, so the card keeps its shape.
- `keptAt` falls back through `createdAt` to `0`, so the document still sorts and still appears under the `orderBy`.
- `parseTheaterDoc` returns `null` rather than throwing when a document has neither `title` nor `pattern`. The archive drops it.

## Accessibility

- The card's accessible name is the whole read. `Men who are good at their jobs and lose anyway. COMPETENCE PORN and NOBODY WINS. 8 films, 5 unseen.` The decorative `×` becomes `and`, contributed by the `sr-only` span in `FacetLine`.
- Without facets the name is the title and the counts. `Rain on glass, nobody talking. 1 film, 0 unseen.`
- `SwatchStrip` is `aria-hidden`. Colour is never the only carrier of a fact.
- Functional metadata on Surface/raised uses Text/secondary, 9.09:1 against `#141416`. Text/tertiary would land at 4.30:1, so it stays on decorative copy.

## Reachability

- `library-row-theaters` routes to `/theaters` and quotes `<n> FACETS YOU KEPT` from the same hook. See F10.
- The `THEATERS` stat on `/me` is `useTheaters().theaters.length`. See F11.

## Ownership

The canonical Theater lives at `users/{uid}/theaters/{id}`, so the path is the ownership claim and no document carries an author field. The owner may create, read, update, and delete their own. Nobody unauthenticated may read or write one, and a second signed-in person may not read, write, or delete another person's, nor create one under their uid.

## Performance verification

`e2e/theater-performance.spec.ts` measures four user-visible intervals. Hunt commit is the first standard TMDB request for the settled query. Theater ready is the first rendered title after `theater-inferring`. Detail-to-ready starts when the Heat heading appears. Reload restore starts before navigation and ends when the restored Theater title appears.

Hunt commit-to-result and inferring-shell-to-ready must each finish within 1500 ms. Reload restore must finish within 500 ms. The test delays the Theater model by 600 ms and each lineup search and detail route by 100 ms. Eight picks hydrate in parallel, so the shell-to-ready controlled floor is 800 ms. Client overhead above that floor must stay within 500 ms. The 2500 ms inference debounce appears only in detail-to-ready and has no shell-to-ready budget.

## Evidence

- `e2e/flows.spec.ts` test `F16 Theater archive` seeds a live Theater, keeps it, walks Library to `/theaters`, asserts the card `aria-label`, the counts line, four swatches, the 190 px height, the sheet lineup, and the matching `/me` count.
- `e2e/flows.spec.ts` test `F13 Movie detail chrome` asserts the compact card on a film page.
- `e2e/flows.spec.ts` test `F16 Theater poster swatches` runs the production sampler and `swatchesFrom` inside the page against routed poster fixtures that answer the way TMDB does, so the real `crossOrigin`, canvas, and aggregation path is what produces the three sampled colours and the fourth fallback. A lineup whose posters all refuse keeps the whole fallback palette.
- `e2e/flows.spec.ts` test `F16 Theater ownership rules` drives the emulator's REST API as the saved account and a second signed-up one and proves the ownership boundary above. The helpers refuse to touch `users/{uid}/theaters` unless `VITE_FIREBASE_EMULATOR` is set or the base URL is loopback, and refuse outright when the emulator host is not loopback.
- `e2e/theater-performance.spec.ts` drives a standard `heat` Hunt through the live runtime, asserts one Theater inference and no reload inference, checks all eight literal reasons, and writes project-specific timing JSON and screenshots.
- `artifacts/verify/F16-mobile/` and `artifacts/verify/F16-desktop/`, including `archive.png` and `thresholds.json`.
- `src/lib/theater/archive.test.ts` pins canonical parsing, legacy parsing, swatch fallback, derived unseen, the exact counts line, both accessible-name shapes, the `1 FILM` singular, and `theaterArchiveState` holding every count back while either source loads.
- `src/lib/theater/posterColor.test.ts` pins the pixel aggregation literally, the four-poster limit, every refusal path, and the fallback the strip lands on. `src/lib/theater/runtime.test.ts` pins that production `theaterInference` passes the sampler through.
- `src/lib/theater/contrast.test.ts` pins the Text/secondary and Accent/select ratios the card depends on.
