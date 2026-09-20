# F11 You

`/me` opens on four live stats. `artifacts/figma/you-after.png` and `artifacts/figma/you-stats-layer-renamed.png` are the design authority for the stat block. The rest of the Figma persona frame (constellation, focus meter, The Assembly, This month's Print) is not built yet.

## Expected

- Header kicker `You`, then the handle or `Set a handle`, then the display name in Archivo.
- The persona line sits under the name once `useUserInsights` resolves. A skeleton holds its place while it loads.
- One stat block, `data-testid="you-stats"`, four columns in this order.

| Position | `you-stat-label` | `you-stat-value` source |
| --- | --- | --- |
| 1 | `WATCHED` | `watchedCount(films)` from the ledger |
| 2 | `WALLET` | `walletCount(films)` from the ledger |
| 3 | `THEATERS` | `useTheaters().theaters.length` |
| 4 | `THIS YEAR` | `distinctWatchedInYear(films, <current year>)` |

- Values are Archivo at the Numeral size in Text/primary. Labels are Martian Mono at the Label size in Text/secondary.
- `THEATERS` stays on one line at a 320 px viewport. The label carries `whitespace-nowrap`, so the e2e check asserts a label box under 16 px tall.
- The THEATERS value is live. Keeping a Theater raises it without a reload, because `useTheaters` holds an `onSnapshot`.
- No `ROOMS` stat and no static Figma number. `581 HOURS` is absent for the same reason as in F10, since runtime is not stored on `LibraryFilm`.
- The ledger drives three of the four counts, so an import moves WATCHED, WALLET, and THIS YEAR together.

## Evidence

- `e2e/flows.spec.ts` test `F11 You` for label order and the 320 px single-line check.
- `e2e/flows.spec.ts` test `F16 Theater archive` for the live THEATERS count after a Keep.
- `artifacts/verify/F11-mobile/` and `artifacts/verify/F11-desktop/`, including `stats.png` and `thresholds.json`.
- `src/lib/library/stats.test.ts` pins `watchedCount`, `walletCount`, and `distinctWatchedInYear` against literal fixtures.
