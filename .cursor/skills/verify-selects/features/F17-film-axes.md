# F17 Film axes

F17 proves the film AXES cache, its Firestore rules, and the kept-Theater reason section.

## First visit

- Clear the deterministic fixture document through the Firestore emulator REST API.
- Open the fixture film in a fresh browser context.
- Assert one model call, eight rows in the required order, five bars per meter, and no reason section when no kept Theater contains the film.
- Check the same table at 390 px and 320 px with no horizontal overflow.

## Cache rules

- Deny an unauthenticated create and read.
- Deny a path whose media type or film id differs from the document.
- Deny the wrong schema, an unknown media type, seven axes, an extra field, or a missing title.
- Allow one valid authenticated create and read.
- Deny update and delete.

## Cache hit and Theater reasons

- Open the same film in a new browser context with an empty prompt cache.
- Assert zero model calls and the same eight AXES rows.
- Seed a kept Theater that contains the film.
- Assert the newest Theater title, the three literal reason rows, and the exclusion of the current film.
- Open `Open in Orbit` and assert `/orbit/:id`.

## Evidence

- `e2e/flows.spec.ts` contains the three F17 lanes.
- `artifacts/verify/F17-mobile/axes.png` and `axes-320.png` prove responsive AXES rendering.
- `artifacts/verify/F17-mobile/theater-reasons.png` proves the reason rows.
- `artifacts/verify/F17-mobile/thresholds.json` and the desktop equivalents record the visual gate.
- `src/lib/theater/filmAxes.test.ts` pins the parser, cache identity, one-call miss, cache hit, refused write, and user-count rule.
