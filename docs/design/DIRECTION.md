# Selects — Brand, System & Motion Direction

**Rev B, updated for round 2.** Rev A was a proposal; this is the spec, written against your
answers to all 36 questions across both rounds. Rationale lives in
[DECISIONS.md](DECISIONS.md); the taste vocabulary has its own document,
[VOCABULARY.md](VOCABULARY.md). Open `direction-board.html` for the visual version — it is live
HTML/CSS and meant to be edited.

Changed materially since rev A: the mark (ring → clapstick), the colour system (single warm
base → reactive film-derived chroma), the home screen (recommendation-first → HomeV2's
carousel plus calendar), the type register (mono-dominant → mono demoted to specs), and the
plan (consolidate by deletion → consolidate by promotion).

---

## 1. Positioning

> **Selects reads you, and hands you the take worth keeping.**

Your own origin story is the product thesis and it should be said out loud in the marketing:
at the end of a shoot day the reels go to the editing room, and someone decides which takes
live. That job — choosing, under time pressure, out of far too much material, most of it not
worth it — is now everyone's job every night.

**Four rules that govern everything below.**

1. **Selects is the mount, not the picture.** The chrome is quiet, precise and confident. The
   films are loud. Every film brings its own logo, its own colour and its own typography, and
   the app's job is to frame them without competing. This is how maximalism and minimalism
   coexist: the maximalism is borrowed, the restraint is ours.
2. **The verdict arrives before the atmosphere.** Anything the user has to wait for is
   decoration on top of the product, not the product.
3. **The intelligence shows up as specificity, never as a robot.** No `Sparkles`, no purple,
   no "AI" in any string. It reacts to what you just did; it does not animate at you.
4. **Investment must be visible.** If logging a film doesn't visibly change something the user
   can see, it will not happen twice.
5. **Never recommend a film they've already seen.** Watched films are excluded from the Ticket
   and from recommendations by default. Rewatch is an **explicit intent** — the user asks, and
   rewatch stubs are marked as such (*"you saw this in 2019"*). They never arrive unasked.
   This only works as well as the app's Depth, which is why **Seen it** (§2) exists: early on
   the exclusion will fail, and the failure has to be one tap from being useful data.

---

## 2. The two objects that close the loop

### Focus

The readiness score. It does not measure whether you're ready to watch — you always are. It
measures **how sharply Selects has you in focus**: how confident the app is that it knows what
you want right now.

That framing is what keeps it honest, and it produces the mechanic the product has been
missing, because **it decays.**

| Contributor | Rises | Decays |
|---|---|---|
| **Depth** | imports, logs | never — your floor |
| **Freshness** | you logged recently | days without a log |
| **Clarity** | recent picks share facets | scattered picks |
| **Context** | time, weather, showtimes near you, hours free | — |

**The number is primary; the state is derived from it.**

| Focus | State | Ticket art |
|---|---|---|
| 0–39 | soft | heavily defocused |
| 40–64 | settling | soft edges |
| 65–84 | sharp | clean |
| 85–100 | locked | clean, grain visible |

The number gives you the climb. The state gives it a tone, so nobody is ever just told they're
a 38. And it's **rendered as literal sharpness** — no dial, no gauge, no percentage ring. You
can read your Focus from across the room without looking at a digit.

**Decay is gentle**: noticeably softer after about a week, not three days. Companion, not nag.
Two logs snap it back — and that is the first thing in the product where investment loads the
next trigger.

### The Ticket

Three stubs a day. Each stub is a film plus one line naming **why today**, drawn from whichever
contributor is doing the work:

- *"It's raining and you have two hours."*
- *"You're four films into heist procedurals. This is the one they were copying."*
- *"70mm. Four blocks away. Sunday, 7:40."*

Three, not one: a single guess can be wrong and wrong kills trust. Three, not six: more than
four rebuilds the paralysis the app exists to end.

### Four actions on a stub

| Action | What it does | What it tells you |
|---|---|---|
| **Tear** | I'm watching this | intent — and it starts the 11:40pm timer |
| **Seen it** | logs the film, swaps in a replacement stub | the fastest logging path in the app |
| **Not tonight** | held over, re-pitched later | a **context** miss |
| **Wrong read** | retired immediately | a **taste** miss |

**Not tonight and Wrong read must stay separate.** One says bad timing, the other says you
don't know me. Collapsing them throws away the difference between a scheduling problem and a
model problem — which is exactly the confusion that makes recommenders feel stupid.

**Seen it is the sleeper.** Because watched films are excluded by default (§1) and that
exclusion is only as good as the app's Depth, tickets *will* surface films the user has already
seen — often, early on. That mistake becomes the lowest-friction logging surface in the
product: one tap, no search, no date picker. And because it raises Depth, the mistake makes the
next ticket better.

**Tearing** is a downward drag, a perforation that resists then gives, a heavy haptic, and a
variable reward behind it.

### The rewards behind the tear

| Reward | Frequency | Feels like |
|---|---|---|
| **Canon** — something about the film nobody told them | common | feeling smart |
| **B-side** — a second, stranger film that pairs with the first | common | a mixtape |
| **Taste note** — an observation about the shape of the map | occasional | being understood |
| **A room opens** — a new facet becomes a place you can go | rare | discovery |

A taste note is about **the map, never the person**. *"This corner is getting dense enough to
have a name"* — not *"you keep choosing men who lose."* The first invites curiosity; the second
is a verdict on someone's character delivered by a phone. Sharp personal reads stay where they
belong: the profile insights and the import reveal, both of which the user chose to open.

Room-unlock is rare *and* valuable precisely because the vocabulary has no index (§7) — an
unlocked room is the only way the territory reveals itself.

### Another take

One refresh per 24 hours. The clapstick claps and three new stubs are struck. Cutting-room
language, and the mark animates it.

### Held Over

A **Not tonight** stub is not discarded. It's held, and it comes back **re-pitched**: a
different poster, a different reason drawn from a different facet, at a different time of day
or a different season. Three passes and it retires as a real negative signal. **Wrong read**
skips all of it and retires on the first tap.

The re-pitch is free: TMDB's `images` endpoint returns many posters and backdrops per film and
`useMovieDetails` already calls it — the app uses one and discards the rest. Same film, new
face, no new integration.

**No screen for held films.** They just reappear. A "missed" list is a chore.

A film passed at 11pm on a Tuesday is not the same film on a Sunday afternoon. Re-pitching is
the cheapest recommendation quality win available, because the hard part — deciding they'd
probably like it — is already done.

### Low confidence is admitted

At Focus 30 the three picks are near-guesses, and the Ticket says so in its own register:
*"Focus is soft today. These are reaches."* Inferred signals compound their error; a
recommender that never admits a weak hand is spending trust it hasn't earned.

The stub is a real-world object on purpose. It prints, it shares, and it is already the right
shape for film-tourism check-ins later.

---

## 3. Naming and information architecture

Everything comes from the cutting room, because the name already did.

| Name | What it is | Today |
|---|---|---|
| **Selects** | the app; the films you keep | — |
| **the Ticket** | your daily three | new |
| **Focus** | how sharply the app has you | new |
| **the Strip** | everything you've logged, zoomable | `MovieCalendarApp` `/app` |
| **the Assembly** | your taste graph | `DNAScreen` + Orbit constellation |
| **Rabbit Hole** | the deep session mode | `OrbitScreen` |
| **the Nudge** | contextual, timed suggestion | `PatternAssistant` |
| **the Cut** | monthly trailer of your month | new |
| **the Print** | shareable still | new |
| **the Wallet** | the handful of films closest to you | new |

Nothing is deleted. Every existing screen keeps its route and gets a job in this system.

**Retire `ViewFindr`.** It still ships in `public/manifest.json` alongside `Selects` in
`vite.config.ts` and `movielcursor` in `package.json`. One name.

---

## 4. The mark

**Six diagonal bars. One of them lit.**

The clapstick's stripes, abstracted — not a clapperboard. It reads as cinema instantly,
survives at 60px because it is pure high-contrast diagonal, and cannot be mistaken for a ring,
a circle, a play triangle or a film strip.

The single accent bar is the entire idea: **six takes, one selected.** The name, drawn.

**Construction.** Six parallelograms, bar width 14 and pitch 24 in a 100-unit square, sheared
so each bar's foot sits directly beneath the previous bar's head (a shear of exactly one
pitch, ≈13.5°). Clipped square. The lit bar is third from the left. SVG only; never a raster,
never on a plate.

**Lockup.** Bars, a full-bar gap, then `SELECTS` in Archivo at `-0.02em`. Icon is the bars
alone at ~78% of the tile.

**Launch animation.** The bars clap shut and rebound, with the haptic. One second, once per
cold start, and it is the whole brand in a gesture.

### The bar is the atom of the system

This is what the ring could not do.

| The bar becomes | Where |
|---|---|
| the mark | six bars, one lit |
| a day | the date strip — one bar per day, detented, haptic per detent |
| a year | 365 bars, each carrying that film's colour |
| a rating | five bars, lit |
| progress | bars filling left to right |
| a rule | a run of small bars instead of a hairline |
| a Ticket stub edge | the perforation |

The sprocket-detent date strip you asked for falls out of the mark rather than being designed
separately.

### Handing it to someone else

The full kit is on the `06 Brand kit` page of the Figma file — clear space, minimum sizes, the
misuse grid, icon and avatar crops, and an inventory of the SVGs in `public/brand`. It instances
the mark components rather than redrawing them, so it cannot drift.

The rules an outside collaborator needs:

- **Clear space is one bar width on every side.** At the drawn size the bar is 14 units in a
  100-unit square, so clear space is 14% of the mark's width. It scales with the mark and is never
  smaller. Nothing enters that box — not type, not a crop edge, not another logo.
- **60px is the floor for the five-bar mark.** Below 48px it smears. Swap to the three-bar icon
  rather than shrinking further; that is what the icon exists for.
- **Six things break it:** rotation, a plate behind it, recolouring, non-proportional scaling,
  outlining, and any shadow. Every one destroys the high-contrast diagonal geometry that makes it
  legible small, which is the only reason it works at all.
- **Never redraw it.** The SVGs in `public/brand` are the source. Never re-export from a
  screenshot, never trace it, never rebuild it in another tool.

---

## 5. Colour

The shell stays out of the way. **All chroma comes from the films, and it moves.**

| Token | Value | Use |
|---|---|---|
| `--base` | `#0A0A0B` | the shell. Near-neutral so it never tints poster colour |
| `--base-2` | `#141416` | raised surfaces, sheets |
| `--base-3` | `#1D1D20` | cards, inputs |
| `--line` | `#2B2B2F` | hairlines, chip borders |
| `--fg` | `#EFEDE9` | primary text, the mark |
| `--fg-2` | `#B9B6B0` | secondary — clears AA on `--base` |
| `--fg-3` | `#7C7A76` | tertiary, mono labels |
| `--select` | `#FF3B14` | the lit bar, and one live state per screen |
| `--film` | *runtime* | dominant colour of whatever film is on screen |
| `--film-2` | *runtime* | secondary poster colour, for the flare |
| `--yours` | *runtime* | the user's own colour — the OKLab chroma centroid of every poster they have logged. See [NEGATIVE.md](NEGATIVE.md) section 2 |

The last three are slots, not colours. They resolve at runtime and they are the only values in the
system nobody gets to pick — `--film` comes from the film on screen, `--yours` comes from
everything the user has ever watched. A second user's colour cannot resolve to the same slot, so
anywhere two people appear side by side (the match screen) one of them is a literal.

**The reactive field.** The Gemini behaviour you pointed at, sourced from films instead of a
brand palette: `--film` and `--film-2` bloom softly under the thumb and settle when released.
The Ticket is lit by the film it's offering. The Assembly is lit entirely by the films in it.
A day in the Strip carries the colour of what you watched.

`extractDominantColor` already exists and currently powers a single background wash in Orbit.
It becomes the palette.

**`--select` is rationed to once per screen.** The moment it appears twice it stops meaning
anything. Everything currently blue, purple, amber, green or red becomes foreground, base, or
nothing. Purple in particular is the universal "an LLM lives here" signal and has to go — it
is currently on the onboarding selection state, every Orbit surface and the chat.

**Grain** at 2–4%, fixed to the viewport. Costs nothing, kills dark-mode banding, and reads
photochemical rather than screen.

---

## 6. Typography

Ship free now, license later.

| Role | Family | Rules |
|---|---|---|
| **Display** | **Archivo Variable** | weight and **width** axes. `-0.03em` at body sizes, `-0.045em` above 32px. Expanded for verdicts, condensed for dense meta. Sentence case, never title case. |
| **Spec** | **Martian Mono** | 11px / `0.08em` / uppercase. Facet chips, formats, runtimes, ratios, timestamps. Tabular numerals. |

Both are free and on Google Fonts, so this ships today. Budget Diatype or Söhne for the
rebrand pass.

Archivo's width axis is the reason to pick it over Inter: one file goes from condensed to
expanded, which is the poster move, and it doesn't read as a default.

**Mono is demoted from rev A.** You rejected the lab-report register — it appears on specs and
facet chips only and never carries body copy.

**The film's own type outranks ours.** TMDB serves logo images and `useMovieDetails` already
fetches them. Wherever a film has a logo, the logo is the title — the app never re-sets
*Mission: Impossible* in Archivo.

| Step | Size | Family | Use |
|---|---|---|---|
| Verdict | 34 / 0.95 | Archivo 800 expanded, `-0.045em` | the line that argues for the film |
| Title | 26 / 1.05 | Archivo 800, `-0.04em` | screen titles, films with no logo |
| Lead | 19 / 1.35 | Archivo 500, `-0.02em` | personalised synopsis |
| Body | 15 / 1.5 | Archivo 400 | prose |
| Meta | 13 / 1.4 | Martian Mono | year · runtime · director |
| Chip | 11 / 1 | Martian Mono 500, `0.08em`, upper | facets, formats |

---

## 7. Taste: two layers

Full spec, including the Nanocrowd teardown and the mining pipeline, is in
**[VOCABULARY.md](VOCABULARY.md)**.

**Layer 1 — the ground truth.** Every film tagged once against a closed eight-axis vocabulary,
cached forever, identical for every user. The vocabulary itself is **mined, not hand-written**:
audience reviews for feeling, critic and trade writing for craft, and structured metadata for
format. This is what the graph computes on.

**Layer 2 — your words.** How those facets are *named and phrased for you*, learned from your
behaviour and your language. Two users read two different sentences off the identical edge.

**Feedback.** Long-press any facet: *wrong / not why I liked it.* Repairs the tag, and the
correction is the best taste signal in the product because the user is telling you *why*.

**The personalisation is disclosed, not hidden.** A small *your name for this* affordance sits
on a facet, and when two people compare graphs both namings show:

> **You call it** sodium-lit and shot wide
> **They call it** that Michael Mann blue

That turns the one moment personalisation could read as a glitch into the moment it is most
obviously deliberate — and it makes the match-percentage screen far more interesting than a
number.

**Every facet is a room.** Tapping one opens the films that share it, under a name written for
you. Tap two and you're in a subset; tap three and you're somewhere nobody else is. That is
the "subsets of subsets of subsets", and it is the Spotify-daylist mechanic applied to film.

### The eight axes

| Axis | Example terms |
|---|---|
| `look` | 35mm grain · sodium-and-cyan night · available light · video-tape texture · high-contrast monochrome |
| `camera` | locked-off · handheld verité · dolly-in on faces · unbroken take · god's-eye overhead |
| `tempo` | slow burn · procedural · breathless · elliptical · dread accumulating |
| `weather` | nobody wins · competence porn · doomed romance · guilt as engine · complicity |
| `sound` | needle-drop maximalism · silence as threat · synth pulse · diegetic only |
| `world` | rain-slick city night · institutional corridors · one apartment · sunbaked backroad |
| `shape` | nonlinear · frame story · two-hander · ensemble braid |
| `format` | 1.37 Academy · 2.39 anamorphic · IMAX 70mm · 16mm blowup |

Every term must be something a person could say out loud at a bar. If it needs explaining it
is the wrong term. `format` is the one axis where jargon is the pleasure.

`world` carries location as a first-class property, which is what Selects Maps will inherit.

**Half these axes cannot be mined from audience reviews.** `camera` and `shape` need critic
writing; `format` needs structured data. That is the concrete reason for the blended corpus —
and it is the gap in Letterboxd's nanogenres, where across every visible example not one term
describes craft. `format` is also nearly free: `api/imdb-techspecs.ts` already fetches IMDb's
technical specs page and keeps two booleans out of it.

**No index.** Facets appear on films and in rooms you arrive at; the whole vocabulary is never
browsable. The territory is discovered, never surveyed — which is what makes an unlocked room
a real reward.

### Edges

Weighted facet overlap, rarer facets weighted higher — TF-IDF across the corpus, so
`heist procedural` far outranks `drama`. No training data needed, explainable, debuggable,
instant.

The edge is rendered as **a sentence made of the overlap**, never a number:

> Heat ↔ The Dark Knight
> `sodium-and-cyan night · procedural · competence porn · rain-slick city night`
> *the city is the antagonist and both men are good at their jobs*

**0.87 is never shown to anyone.** Strength drives line weight and opacity.

### "What did you like about this?"

One free-text line, offered on any film. Your Guy Ritchie → *Seven Psychopaths* route only
existed because you wrote a paragraph describing the quality you wanted. That paragraph is the
facet system in plain English. It is the richest signal available, users give it willingly
because it feels like talking rather than rating, and it feeds Layer 2 directly.

### What replaces `GENRE_MAP`

Every prompt currently interpolating TMDB's 19 genre strings — pattern analysis, Orbit's
balanced prompt, discover, similar vibes. Plus: chips on the film page where nothing renders
today; node colour and edge labels in the Assembly; the Nudge's copy; the similar-films
heading, which becomes the shared facet — *"Because of the night"* rather than *"Similar Films"*.

---

## 8. The Assembly

Your taste graph. Every film you've logged, laid out and connected, extending outward into
films you haven't seen.

- **Seen** films are solid and carry their own poster colour. **Unseen** are outlined and
  colourless. Logging fills one in — **your map visibly grows when you log**, which is the
  reward the calendar has never paid.
- **Node colour is the film's colour.** Never a category palette. This alone makes the graph
  impossible to mistake for generic data-viz.
- **Traversal is a dot travelling an edge**, and the edge label writes itself once as the dot
  moves. This is the only place in the app where progressive text is allowed, because here it
  maps to physical motion rather than imitating a chatbot.
- **Layout differs by how you use the app.** Someone who lives in Rabbit Hole gets a map
  dominated by their paths; someone who logs compulsively gets one dominated by density. Two
  users at 99% taste match should not get the same picture.
- **The Wallet** — the handful of films closest to you — anchors the centre.

**Search is the Assembly with a query at the centre.** Your spherical-web idea: typing a title
doesn't return a list, it drops you into the graph at that film with its neighbours around
you, swipeable in any direction. Same renderer, different entry point — not a separate build.

Rabbit Hole is the Assembly in motion; the Assembly is Rabbit Hole at rest. One graph, two
verbs, and `DNAScreen` and the Orbit constellation both become views of it without either
being removed.

---

## 9. The 11:40pm loop

The strongest untapped trigger in the category, and the mechanism is already in your data.

1. **The app knows the film is ending.** The Ticket was torn at 9:15, runtime is 170 minutes.
   Or a calendar log has a start time. Or they tapped "watching now." No guessing — and note
   that this is the strongest argument for the Ticket: *it is the only feature that tells you
   when someone is inside a film.*
2. **Verdict push, 10–15 minutes after the credits.** *"So. Did the ending earn it?"*
3. **One tap logs it.** Rating, and an optional line — the *Days of Thunder* note, no F1 films
   without it. Those lines are the most personal thing in the product and eventually they are
   what the Cut is narrated by.
4. **Then the door.** *"That corridor shot is lifted from Oldboy."* Which opens the Assembly at
   that film, and the collaborator paths go from there — Hardy to Nolan to Murphy to Peaky
   Blinders. Or the questions: what does this signify, were they running, what did they forget.
5. **Then the three.** Not "similar films" — *"three more where the city is the antagonist."*
   Each with its reason stated, because you were right that genre-adjacency is stale and
   everyone can feel it.

---

## 10. Motion

The jank isn't easing. **Elements teleport.** The poster in the onboarding grid, the poster in
the confirmation sheet and the poster on the film page are three unrelated DOM nodes that
never acknowledge each other.

### The one rule

**The poster is the transition.** Framer Motion is already a dependency. Every poster gets
`layoutId={`poster-${id}`}` and physically travels: swipe card → Ticket stub → hero → day bar
→ Assembly node → Print. Nothing cuts.

### Tokens

| Token | Value | Use |
|---|---|---|
| `swift` | 140ms · `cubic-bezier(.2,0,.2,1)` | taps, chips, toggles |
| `travel` | spring 420 / 34 | shared-element morphs |
| `settle` | spring 260 / 28 | sheets, screen entry |
| `tear` | 260ms · `cubic-bezier(.36,0,.1,1)` | the Ticket perforation |
| `drift` | 8s linear ∞ | hero carousel, Assembly idle |
| `arc` | 620ms · `cubic-bezier(.65,0,.35,1)` | a dot travelling an edge |
| `clap` | 380ms spring 500 / 22 | the launch mark |
| `develop` | 1400ms · `cubic-bezier(.16,1,.3,1)` · 8ms stagger per node | the dot cloud resolving into the Negative |

Nothing changes state instantly except text already on screen.

`develop` is named for the process: a negative is exposed, then developed. It is the slowest token
in the system on purpose — it is the only moment where the app is visibly doing work the user
cannot do themselves, and rushing it wastes the one time impatience is an asset. Idle drift on the
Negative reuses `drift`; entering a node from an insight card reuses `arc`.

### Canonical moments

**The tear.** Drag the stub down, the perforation resists, gives, and the film's colour floods
the screen. Heavy haptic plus success. The variable reward lands underneath.

**The log.** Poster leaves the sheet, travels, lands in the day bar, takes that day's colour,
Focus visibly sharpens and the count rolls. This replaces the current reward, which is a 44px
near-black square.

**The strip.** One detent per day, one `selection` haptic per detent. Fling and the detents
blur into a run.

**Assembly traversal.** Dot leaves, travels the edge on `arc`, edge label writes once, new node
scales to 1, old drops to 0.4.

**Hero arrival.** Backdrop paints at full opacity immediately — never a black rectangle. Video
fades in over it once buffered. Logo and verdict are legible before the video exists. If the
video never loads, the screen is still complete.

### Haptics

Built (`src/lib/haptics.ts`) and currently firing only in Orbit.

| Event | Haptic |
|---|---|
| Tear a stub | `heavy` + `success` |
| Log a film | `medium` + `success` |
| Date strip detent | `selection` |
| Facet chip | `selection` |
| Assembly node arrival | `light` |
| Edge of the graph | `warning` |
| Launch clap | `heavy` |

### Skeletons, not spinners

One centred spinner per screen is the strongest "generic web app" signal in the product.
Replace every one: the poster's own colour as a blurred plate, mono labels in place at 20%,
content filling in. The layout never moves once painted.

---

## 11. Voice

**Who is speaking:** someone who has seen everything and doesn't need you to know that.
Declarative, present tense, unimpressed. A projectionist, not a critic, and nowhere near a
brand.

1. Never *AI*, *powered by*, *generate*, *curated*, *vibes*, *personalized*, *smart*, *magic*,
   *journey*.
2. Never explain the mechanism. They don't want to know it read their Letterboxd; they want to
   be understood.
3. Buttons are verbs: `Tear`, `Log`, `Open`, `Import`. Never `Submit`, `Continue`,
   `Get Started`.
4. Specific nouns beat adjectives. *Sodium-lit* over *atmospheric*. *Nobody wins* over *gritty*.
5. One dry joke per screen. Zero exclamation marks.
6. When the app talks about the user it observes. It never compliments.
7. **80/20 on sharpness.** Four in five reads are warm and useful; one in five is
   uncomfortable. The uncomfortable ones only appear in two places the user chose to open —
   profile insights and the import reveal. Never unrequested on a film page.

### The Nudge

Reactive, never running. After three circling searches a bar rises:

> **You're three deep in heist procedurals.** Rabbit hole? — *5s*

Five-second ring, acts if you don't dismiss it, gone if ignored. Your Cursor reference,
built. `PatternAssistant` is already most of it.

### Push register

Funny enough to be worth the tap, rare enough that the joke still lands. **The budget is two to
three scheduled pushes a week.** Zomato gets away with volume because the purchase is cheap and
impulsive; a film is two hours and a wrong nudge is expensive.

| Type | Fires | Counts against the budget |
|---|---|---|
| **Ticket** | 2–3 × week, on the days the read is strongest | yes |
| **Verdict** | 10–15 min after a film you actually started | **no** |
| **Drop** | rare — 70mm near you, or newly streaming | yes |
| **Focus** | rarely, always with an offer | yes |

**The Ticket exists daily in the app but is only pushed a few times a week.** The widget and the
habit carry the other days, and the push stays worth opening. **Event-driven pushes sit outside
the budget** because they're earned by something the user just did — a Verdict is a reply, not
an interruption.

| Type | Example |
|---|---|
| Ticket | "Tuesday's ticket. Three, and one of them is a reach." |
| Verdict | "So. Did the ending earn it?" |
| Drop | "Heat. 70mm. Four blocks away. Sunday." |
| Focus | "You've gone soft. Two logs and I'll have you sharp again." |

### Before / after

| Surface | Now | Proposed |
|---|---|---|
| Splash | "Your Personal Cinema Journal" | `Selects` — nothing else |
| Onboarding | "Your cinema. Understood. / A few questions to get started." | "Three films you'd rewatch tonight." |
| Film CTA | "Ask AI" | the first suggested question, verbatim |
| Similar | "Similar Films" | "Because of the night" |
| Import done | "Imported ✓" | "856 films. Here's what they say about you." |
| Logged | "Movie Logged!" | "Kept. 41 this year." |
| Empty list | "No movies yet" | "Nothing queued. That's a choice." |
| Waitlist | "Reach out to the team" *(no link)* | "Not open yet. Leave an email and one line about the last film that wrecked you." |
| Pattern | "Pattern Detected • 4 films explored" | "You keep choosing men who lose." |
| Rec label | "NEXT WATCH" | "Tonight" |

The pattern prompt already has this voice — *"Ah, the 'morally bankrupt men doing crimes with
style' marathon."* It exists in the prompts and nowhere in the chrome. Make the chrome match
the prompts, not the reverse.

---

## 12. Onboarding

Reward before investment. Currently pages 5 and 6 ask for a Letterboxd username and an IMDb
CSV before the user has seen a single recommendation.

1. **Swipe to calibrate.** A poster, four directions — right: seen it, loved it. Left: seen it,
   didn't land. Up: haven't seen it, want to. Down: not for me. Two bits per swipe instead of
   one, faster than tapping, and it teaches Rabbit Hole's gesture while it builds the graph.
   Around forty swipes is a usable Assembly.
2. **The read.** The swipes converge into one sentence that is uncomfortably accurate, plus the
   facets it read off them. This is where they decide.
3. **One Ticket**, torn. Value delivered before anything is asked for.
4. **Then Letterboxd** — username only, reframed as *"I can read your last fifty in four
   seconds."*

**Import.** Username gets the public RSS diary — recent films *with ratings* — instantly, which
is enough for a real reveal. Full history still needs the CSV. So: username first for the hit,
CSV offered afterwards, once they already believe you.

**The reveal.** Checkmark, **"856 films imported"**, one number-forward line with an absurd
true equivalence, and an **Explore** button with nothing competing with it. Explore opens the
Assembly. If it isn't built yet, say so and push when it is.

The reveal carries the sharp reads: time-of-day patterns, the dominant colour across your
posters, the brothers observation, and the blind spots — including the ones nobody would guess.
Not "favourite director, favourite genre."

**Morphs, not cuts.** Every step today is `if (page === N) return`. The chosen posters converge
and collapse into the read; `layoutId` per poster, `settle`, staggered 60ms.

---

## 13. The artifacts

A ladder, so it ships and stays affordable.

| Rung | What | Who |
|---|---|---|
| **the Print** | still one-sheet — your films, your dominant colour, your top facets, one line about who you were | everyone, monthly |
| **the Cut** | 20–30s cut of trailer clips, dialogue and title cards, your month as a slate trailer | anyone who logged enough that month |
| **the Year** | the long one | December |

Making the Cut **earned** does two jobs: it controls render cost, and it turns logging into the
thing that unlocks the artifact — a fixed-ratio reward on exactly the behaviour you need.

*Rights flag:* build the Cut from trailers, stills and logos. Trailer footage is promotional
and widely tolerated; feature footage is not.

**The Assembly is public by default**, private on request, shareable at any horizon — a week, a
month, a year, each as its own Print. No per-platform buttons; one image, one long-press, the
OS sheet.

**Match percentage** on another user's profile, top right. Cheapest, highest-value social
object in the category, and the thing people screenshot.

---

## 14. Crossing surfaces

| Surface | The same system |
|---|---|
| **Phone** | Ticket stubs, the Strip's bars, the Assembly lit by your films |
| **Widget** | one bar per recent day, one tap to log. A second trigger channel for almost nothing |
| **Real life** | the Print at A3 — two inks, so it screen-prints. Sticker sheets of your facets. The Ticket stub is already a physical object |
| **Cinema** | the vocabulary *is* cinema's: 1.37, 70mm, sodium light. Typeset like a rep-house calendar, not an app export |
| **Web** | the hero is a live Print of a real user's month, regenerating. No feature grid, no phone mockups on gradients |

The palette is deliberately two-ink plus film colour, which means a $2 poster and a $0.40
sticker. Cheapest brand distribution a film app will ever have.

---

## 15. What this replaces

| Rev A / today | Rev B |
|---|---|
| grease-pencil ring | six clapstick bars, one lit |
| `#09090b` zinc, single warm base | `#0A0A0B` neutral shell, all chroma from films, reactive |
| system font stack | Archivo Variable + Martian Mono |
| mono-dominant lab report | mono demoted to specs; the film's logo does the talking |
| 19 TMDB genres | closed eight-axis spine, open personalised surface, every facet a room |
| recommendation-first home | HomeV2: carousel + logo + detented date strip |
| consolidate by deleting | consolidate by promoting; nothing removed |
| centred spinners | poster-coloured skeletons |
| hard cuts | the poster is the transition |
| numeric similarity, unshown | facet overlap, shown as a sentence |
| ViewFindr / Selects / movielcursor | Selects |
| one push a day, ceiling of two | 2–3 scheduled a week; event pushes outside the budget |
| Focus as an open question | a number 0–100 driving soft / settling / sharp / locked |
| a single dismiss on a stub | four actions — tear, seen it, not tonight, wrong read |
| passed films discarded | Held Over — re-pitched with a different poster and a different reason |
| a hand-written seed corpus | a mined vocabulary; you approve rather than author |
| vocabulary possibly browsable | no index. Discovered, never surveyed |
