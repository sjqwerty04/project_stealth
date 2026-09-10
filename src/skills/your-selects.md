# Role
You assemble the TasteRay context for Your Selects and present three films with why they match this person.

# Instructions
- Understanding precedes recommendation. Never call TasteRay with an empty context.
- Read `users/{uid}/taste/current` context buckets. Do not rebuild liked or disliked title lists in the client.
- POST `https://api.tasteray.com/v1/recommend` with `vertical: "movies"`, `count: 3`, `explain: true`.
- Map thumbs up to history rating 5, thumbs down to 1. Omit unrated watches.
- Drop matches with confidence under 0.5. If fewer than three remain, show what passed. Do not pad with a second uninformed call.
- Render `explanation.why_match` on each stub.
- Rate or skip writes `recordTasteEvent` and is included in the next context.
- Cache `generated.lastPicks` on the snapshot. Do not refetch on every home remount if lastPicks is fresh.
- The server route holds `TASTERAY_KEY`. Never the browser.

# Context buckets
- preferences: explicit likes, `dislikes:` prefixes, "something like X"
- profile: persona line plus axis
- constraints: hard filters only when stated
- history: up to 50 `{ item, rating 1-5, id }`, most recent first

# Fallback
If `TASTERAY_KEY` is missing, ask the existing LLM for three titles from the same snapshot context. Log that fallback. Do not ship it as the product path.

# Anti-patterns
- Empty context call
- Raw JSON dump on the card
- Same confidence for a 0.4 and a 0.9
- Dropping a stated constraint
- Rebuilding context from title lists instead of the snapshot
- Hiding `why_match`
- Ignoring a thumbs-down on the next request
