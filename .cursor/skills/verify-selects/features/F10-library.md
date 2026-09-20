# F10 Library

The Library hub on `/watched` is exactly five rows in Figma order. `artifacts/figma/library-after.png` is the design authority.

## Expected

- Kicker `LIBRARY`, subcopy `EVERYTHING YOU HAVE KEPT`, both Martian Mono at the Label size.
- Five rows, in this order, each a single button with a left rule, a display-type label, and a Martian Mono metadata line.

| testid | Label | Metadata | Route |
| --- | --- | --- | --- |
| `library-row-watched` | Watched | `<n> FILMS` | `/watched#timeline` |
| `library-row-wallet` | The Wallet | `<n> FILMS CLOSEST TO YOU` | `/liked` |
| `library-row-saved` | Saved | `<n> WAITING` | `/saved` |
| `library-row-theaters` | Theaters | `<n> FACETS YOU KEPT` | `/theaters` |
| `library-row-shared-lists` | Shared lists | `<n> LISTS · <m> PEOPLE` | `/shared` |

- Inside a row the label is `library-label` and the metadata is `library-meta`. Neither shares the `library-row-` prefix, so a prefix selector counts five rows and not fifteen nodes.
- Every count is live. Watched, The Wallet, and Saved read the film ledger through `useLibrary`. Theaters reads `useTheaters`. Shared lists reads `useSharedWatchlists` and counts distinct member uids.
- Singular forms at a count of one are `1 FILM`, `1 FACET YOU KEPT`, and `1 LIST · 1 PERSON`. The Figma's `581 HOURS` is not rendered, because runtime is not stored in `LibraryFilm`.
- No Lists row and no second Theaters row. `/watchlist` stays routable from Saved, The Wallet, and personal-list back links.
- Every row clears a 44 px target. Metadata uses Text/secondary on Surface/raised so it holds AA.

## Evidence

- `e2e/flows.spec.ts` test `F10 Library`.
- `artifacts/verify/F10-mobile/` and `artifacts/verify/F10-desktop/`, including `thresholds.json`.
- `src/components/libraryRows.test.ts` pins every label, route, and singular and plural metadata line.
- `src/lib/library/stats.test.ts` pins the counts the rows quote.
