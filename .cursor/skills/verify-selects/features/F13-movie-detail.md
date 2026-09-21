# F13 Movie detail

The film page. `/movie/:id?type=movie|tv` renders, in order: backdrop and title block, `RatingBadges`, `MovieActions`, the known-for read at `why-you-would-like-this`, Synopsis, the compact Theater card when a session is showing, Cast, the Orbit CTA, Ask AI, then Similar Films.

There is no AXES table and no kept-Theater reason list.

## Save as engagement

`MovieActions` takes one narrow callback, `onSaveIntent`, and `openSavePicker` spends it in the same press that opens `AddToListPicker`. The film page passes `markTheaterEngaged(details.id)`, so choosing to save a film counts as engagement even when the person closes the picker without filing it anywhere. The dwell signal that leaves with the screen then carries `engaged: true` below the twelve-second floor. The picker's close control carries `aria-label="Close list picker"`.

## The Orbit CTA

`Open in Orbit`, full width, Text/primary fill, Surface/base label, square corners, 56 px tall. `orbit-cta` and the route to `/orbit/:id` are unchanged. `Ask AI` sits below it on its own row and opens the chat sheet.

## Evidence

- `e2e/flows.spec.ts` test `F13 Movie detail chrome` asserts the absent AXES and reason sections, the full-width CTA, and the compact Theater card.
- `e2e/flows.spec.ts` test `F13 Save engagement` presses Save, closes the picker, leaves through the Orbit CTA, and reads the stored session: one dwell signal for that film, `engaged: true`.
- `src/components/saveIntent.test.ts` pins the press: the picker opens, one intent is published per press, and a caller that listens for nothing still gets its picker.
- `artifacts/verify/F13-mobile/` and `artifacts/verify/F13-desktop/`.
