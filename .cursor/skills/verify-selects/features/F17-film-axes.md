# F17 Film axes

F17 proves the film AXES cache, its Firestore rules, and the kept-Theater reason section.

## First visit

- Sign in, then clear the deterministic fixture document under that person's uid through the Firestore emulator REST API.
- Open the fixture film in a fresh browser context.
- Assert one model call, eight rows in the required order, five bars per meter, and no reason section when no kept Theater contains the film.
- Check the same table at 390 px and 320 px with no horizontal overflow.

## Cache rules

The cache lives at `users/{uid}/film_axes/{mediaType}:{filmId}`, so the path is the ownership claim. The lane signs in as the saved account and signs up a second one, then drives the emulator's REST API as both.

- Deny a create and a read on the retired shared `film_axes` collection.
- Deny an unauthenticated create and read.
- Deny the second person a create and a read under the first person's uid, before and after the document exists.
- Deny a path whose media type or film id differs from the document.
- Deny the wrong schema, an unknown media type, an extra field, a missing, empty, or 201-character title, and a 17-character year.
- Deny seven axes, nine axes, and the eight axes reversed.
- Deny a renamed axis, an empty or 81-character value, a score of 0, 6, or 2.5, and a fourth key on an axis.
- Allow the owner one valid create and read, and allow the second person the same film under their own uid.
- Deny update and delete to the owner.

## Cache hit and Theater reasons

- Open the same film in a new browser context with an empty prompt cache.
- Assert zero model calls and the same eight AXES rows, which can only have come from that person's own cached document.
- Seed a kept Theater that contains the film.
- Assert the newest Theater title, the three literal reason rows, and the exclusion of the current film.
- Open `Open in Orbit` and assert `/orbit/:id`.

## Cache hit under load

`e2e/theater-performance.spec.ts` closes the first browser context and signs in again in a fresh one before reopening the film. The first visit costs one model call, the fresh session costs none, and `artifacts/verify/theater-performance-<project>/film-axes-cache.json` records both counts with the owner-scoped path. The Theater budget lane stubs film axes with an empty reply, so nothing is cacheable there and each page load costs exactly one call.

## Evidence

- `e2e/flows.spec.ts` contains the three F17 lanes.
- `artifacts/verify/F17-mobile/axes.png` and `axes-320.png` prove responsive AXES rendering.
- `artifacts/verify/F17-mobile/theater-reasons.png` proves the reason rows.
- `artifacts/verify/F17-mobile/thresholds.json` and the desktop equivalents record the visual gate.
- `src/lib/theater/filmAxes.test.ts` pins the parser, cache identity, one-call miss, cache hit, refused write, and user-count rule.
