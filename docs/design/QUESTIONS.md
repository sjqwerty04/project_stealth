# Questions — round 3

Rounds 1 and 2 are answered and locked in [DECISIONS.md](DECISIONS.md). Five left, and they're
smaller again — three of them are tensions between two things you've already decided, which is
usually a sign the design is nearly settled.

Two are **BLOCKING**.

---

**1. BLOCKING — Does *Seen it* ask for a rating?**

Two of your own answers pull against each other here.

Round 1 Q11: ratings matter, because inferred signals compound their error and explicit input
is the ground truth that stops the drift. Round 2 Q9: highest quality, **least friction**.

*Seen it* is meant to be one tap. Adding a rating makes it two, on the action people will use
most in their first month — and a rating you nagged someone into is worth less than one they
volunteered.

Three shapes:

- **Log it silently.** One tap. You learn they've seen it, nothing more. Fastest, weakest.
- **Log, then offer.** One tap logs it and the replacement stub slides in; a small rating
  control stays on screen for a few seconds and is ignorable. Costs nothing to skip.
- **Log and require.** Two taps, always. Best data, most friction, and it punishes the user for
  the app's mistake.

*My leaning: log, then offer.* It respects that the recommendation was wrong — you don't get to
charge someone for correcting you.

**2. BLOCKING — How does a user ask for a rewatch?**

You locked that watched films never arrive unasked. So there has to be a door, and where you
put it changes how often the feature gets used:

- **A mode** — a toggle on the Ticket: *"something I've seen."* Explicit, discoverable, and
  mostly ignored.
- **An intent in search** — you go looking, and rewatches are simply not excluded there.
  Invisible until wanted, but no prompt ever surfaces it.
- **The app offers, on the right night** — high Focus, a wet Sunday, and one of the three stubs
  is marked *"you saw this in 2019."* Best feeling, but it edges toward recommending a watched
  film unasked, which is the thing you ruled out.

*My leaning: the mode, plus rewatches never being excluded from search.* The third option is
lovely and I don't want to smuggle it past a rule you set deliberately — so if you want it, say
so and I'll spec it as an opt-in.

**3. When a stub gets *Wrong read*, do you ask why?**

The tap alone tells you the film was wrong. One more beat — *which part was wrong?*, with the
three facets that drove the pick as tappable chips — tells you **which facet is mis-tagged**,
which is worth an order of magnitude more and repairs Layer 1 for everyone.

But it's friction at the exact moment someone is already mildly annoyed.

*My leaning: ask, but only sometimes.* Every fifth *Wrong read*, not every one. Variable on the
app's side rather than the user's, and it keeps the action feeling free.

**4. Who picks the 2,000-film spine?**

`VOCABULARY.md §5` needs a seed list spanning eras, movements, budgets and countries — and
explicitly **not** the top 2,000 by popularity, or the vocabulary comes out shaped like a
multiplex. That list determines the ceiling of everything the app can ever say.

Three ways: you write it, we derive it from canonical lists (Sight & Sound, Criterion,
festival slates, TSPDT) and you edit, or we sample TMDB stratified by decade, country and
budget.

*My leaning: derive and edit.* Same "approve, don't author" shape as the facets — you get a
list with obvious gaps visible and you fill them, which is where your taste actually adds
something a sampler can't.

**5. When do the two or three weekly pushes fire?**

You set the budget; the timing is still open. Fixed hour on fixed days is predictable and
easily ignored. Learned — the app watches when you actually open it and settles there — is
better and takes weeks of data to get right. Contextual — Friday evening, a rainy Sunday, the
night after you finished something — is the best and the most likely to misfire early.

*My leaning: start fixed at a user-chosen hour, on Thursday/Friday/Sunday, and let it drift
toward learned once there's enough signal.* Predictable is a fine place to start when the
alternative is being wrong at 11am on a Monday.

---

## Decided on your behalf — say the word and I'll flip them

- **The Cut's length is what's earned**, and everyone gets one. Five films buys fifteen
  seconds, twenty buys a minute. You answered Q9 with a principle rather than a threshold, so I
  took the lowest-friction reading of it: nobody is excluded, the incentive is continuous, and
  render cost scales with engagement instead of signups.
- **No screen for held-over films.** They just reappear, re-pitched. A "missed" list is a chore.
- **Three passes then retire**, for held-over stubs. *Wrong read* retires on the first tap.

## Still flagged, not asked

- **A start time on `calendar_logs`.** Schema change, and it's what makes the 11:40pm push work.
- **Corpus terms of use.** Reddit has an API with defined terms; bulk-harvesting Letterboxd
  reviews probably isn't permitted. Worth checking before the mining pipeline is built — a
  licensed or public critic corpus plus Reddit may be the safer construction anyway, and the
  critic half is where the scarce craft language lives.
- **A trademark and visual-similarity check on the clapstick** before it goes near a store
  listing.
