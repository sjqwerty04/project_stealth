# F8 Orbit hunt

Orbit tab → search on `/discover` → detail → Orbit CTA → `/orbit/:id`.

Performance coverage lives in `e2e/orbit-performance.spec.ts`.

- Exercise a ready directional swipe from a fixed seed.
- Record five gesture-to-card samples plus p50 and p95.
- Assert one generation request per source, direction, and taste key.
- Keep p95 below 500 ms under deterministic provider timings.
- Preserve the direction prompt, taste text, recommendation, reason, and score.
