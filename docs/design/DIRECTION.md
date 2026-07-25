# Selects — Brand, System & Motion Direction

Companion to `AUDIT.md`. This is a proposal, not a decision — several calls in here depend
on answers to `QUESTIONS.md`. Open `direction-board.html` in a browser for the visual
version; everything in that file is live HTML/CSS and meant to be edited.

---

## 1. Positioning

> **Selects reads your taste and hands you one film.**

Three constraints that everything else is measured against:

1. **The verdict arrives before the atmosphere.** Anything a user must wait for is not the
   product; it is decoration on top of the product.
2. **The intelligence shows up as specificity, never as a robot.** No `Sparkles`, no purple,
   no "AI" in any string, no typewriter effects, no button that announces a machine.
3. **Maximal information density, minimal decoration density.** This is how "maximalist" and
   "very subtle" reconcile. Dense type, dense data, hard grid — and zero gradients, zero
   glows, zero blur, zero drop shadows. All chroma comes from the films themselves.

### The daily reason

`AUDIT.md §5.6` names the gap: everything on the roadmap is a *second*-session feature.
There is no reason to open the app on an ordinary Tuesday. Proposal:

**Tonight.** One film, chosen for this specific evening, already waiting when the app opens.
Different from yesterday's. The reason references the user, not the film — *"You've been
three deep in sodium-lit crime. This is the one that started it."* Delivered at an hour the
user picks, once a day, and never more.

That is the Oura-morning-number equivalent: something already different before you ask. It
is the smallest possible feature that closes the loop, and it is the one thing I would build
before anything in this document.

---

## 2. The name

Keep **Selects**. It is an editing-room word — the takes the editor pulled — so it is
insider without being cute, and it describes the product's job rather than its category.

Retire **ViewFindr** today: dropped-vowel startup naming reads 2014, and shipping two names
in one binary (`public/manifest.json:2` vs `vite.config.ts:26`) costs recognition on every
install. Also rename the package off `movielcursor` and the cache key off `movielove_*`.

One flag for you: "Selects" is a common English word, so app-store search and the domain are
worth checking before the mark is finalised. See `QUESTIONS.md`.

---

## 3. The mark

**A hand-drawn ring — the grease-pencil circle an editor draws around a select.**

Why this and not another film strip:

- It is **literally the product's name as a gesture**. Circling the take you're keeping is
  what "selects" means.
- It is **analog and imperfect**, which is how you get an AI-dense product that doesn't read
  as AI. A hand-drawn stroke cannot look like a machine made it.
- It **survives at 60px** on a crowded home screen — a thick bone-coloured ring on warm ink
  is legible at any size, which the current sprocket icon is not (it is dark grey on black
  and disappears entirely).
- It is **reusable as a UI primitive**, which is the property the current mark lacks
  entirely. The ring becomes: the node in the taste graph, the orbit path, the focus ring
  around a poster, the progress indicator, the avatar frame, the loading state, and the
  "logged" stamp on a day. Oura's ring is both its logo and its progress arc; that is the
  economy to aim for.

**Construction.** Single stroke, ~11% of diameter. One deliberate gap where the pencil
lifted — this is the distinguishing feature, and it also gives the ring a start and end so
it can animate as a progress arc. Slight ellipse and stroke-width variance; never a perfect
circle. Ships as SVG only.

**Lockup.** Ring, then a full-height gap, then `SELECTS` in the display grotesk at
`tracking-[-0.02em]`. Never on a plate, never in a box, always on transparent — the opposite
of the current PNG. Icon = ring alone, optically centred, ~62% of the tile.

**Risk, stated plainly:** rings are a crowded space in logo design. Before this is
finalised, run a trademark and visual-similarity check. The gap plus the hand-drawn variance
plus the bone-on-warm-ink palette is what makes it defensible; a clean geometric ring would
not be.

---

## 4. Colour

The current base is `#09090b` — Tailwind `zinc-950`, the most common dark-mode default in
existence. It reads "template", not "cinema". Replace it with a **warm** black: a darkened
auditorium rather than an OLED test card.

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0B0A08` | base surface |
| `--ink-2` | `#15130F` | raised surface, sheets |
| `--ink-3` | `#1E1B16` | cards, inputs |
| `--ink-4` | `#2A251E` | hairlines, dividers, chip fills |
| `--bone` | `#EDE7DA` | primary text, the mark |
| `--bone-2` | `#C4BCAD` | secondary text — clears AA on `--ink` |
| `--bone-3` | `#8A8275` | tertiary, mono labels |
| `--grease` | `#E8391A` | the mark, and exactly one live state per screen |
| `--film` | *runtime* | dominant colour extracted from the current poster |

Two rules that matter more than the values:

**`--grease` is rationed.** One use per screen, maximum. It is the eye's anchor; the moment
it appears twice it stops meaning anything. Everything currently coloured blue, purple, or
amber becomes bone, ink, or nothing.

**`--film` carries all the chroma.** `extractDominantColor` already exists
(`OrbitScreen.tsx:69-116`) and is spent on one background wash. It should drive the whole
palette of whatever film is on screen — hero grade, node colour in the graph, the day cell,
the tag underline, the one-sheet. This is the single change that makes the app impossible to
mistake for a template, because its colour comes from the content and therefore never repeats.

**Deleted:** every `blue-*`, `purple-*`, `amber-*`, `green-*`/`red-*` Tailwind default. Like
and pass become bone and ink with different weights, not green and red.

**Grain.** A 2–4% monochrome noise overlay across every surface, fixed to the viewport so it
does not scroll. It costs nothing, kills dark-mode banding on gradients, and is the cheapest
possible signal of "photochemical" rather than "screen".

---

## 5. Typography

Nothing is loaded today (`index.html`), so every heading is Helvetica or Roboto. This is the
largest single gap between the current app and the brief.

**Two families, strictly divided.**

| Role | Family | Rules |
|---|---|---|
| **Display** — titles, verdicts, one-liners | Tight grotesk | `-0.03em` tracking at body sizes, `-0.045em` above 32px. Weights 500 and 800 only — no 600/700 middle ground. Sentence case for verdicts, never title case. |
| **Mono** — all metadata | Monospace | 11px / `0.08em` / uppercase for labels. Tabular numerals everywhere. Runtimes, years, ratios, formats, facet tags, edge labels, timestamps. |

The mono split is the load-bearing decision. It gives you the **spec-sheet register** the
technical-specs feature needs (`1.43:1 · IMAX 70MM · 15/70 NEG`), and — more importantly — it
makes AI-written text read as *readout* rather than *chat*. A one-liner set in mono is a
lab result. The same sentence in a rounded sans with a sparkle is a chatbot. Same words,
opposite product.

**Licensing.** The ideal pairing for the Brooklyn-flyer register you described is
**ABC Diatype + Diatype Mono** (Dinamo). Alternatives worth comparing: Söhne + Söhne Mono
(Klim), Neue Haas Grotesk Display + a mono of choice. Zero-cost interim that gets 80% of the
way: **Inter** (with `tracking` tightened aggressively — Inter's defaults are far too loose
for this) + **JetBrains Mono**. Self-host, subset to Latin, `font-display: swap`, preload the
two weights actually used. Do not ship four weights.

**Type scale** (`rem` at 16px base):

| Step | Size | Family / weight | Use |
|---|---|---|---|
| Verdict | 34 / 0.95 | Display 800, `-0.045em` | the one-liner that sells the film |
| Title | 26 / 1.05 | Display 800, `-0.04em` | film titles, screen titles |
| Lead | 19 / 1.35 | Display 500, `-0.02em` | personalised synopsis |
| Body | 15 / 1.5 | Display 500, `-0.01em` | prose |
| Meta | 13 / 1.4 | Mono 400 | year · runtime · director |
| Label | 11 / 1 | Mono 500, `0.08em`, upper | section labels, facet tags |

**Numerals are a brand surface.** Ratings, runtimes, years, counts, aspect ratios — all
tabular mono. Big numbers set large and tight is the core move of the poster vocabulary you
described, and it costs nothing.

---

## 6. Voice

**Who is speaking:** someone who has seen everything and does not need you to know that.
Declarative, present tense, unimpressed. Closer to a projectionist than a critic, and
nowhere near a brand.

**Rules**

1. Never the words *AI*, *powered by*, *generate*, *curated*, *vibes*, *personalized*,
   *smart*, *magic*, *journey*.
2. Never explain the mechanism. The user does not want to know it read their Letterboxd; they
   want to be understood.
3. Verbs on buttons: `Log`, `Save`, `Open`, `Import`, `Circle it`. Never `Submit`, `Continue`,
   `Get Started`, `Learn More`.
4. Specific nouns beat adjectives. "Sodium-lit" over "atmospheric". "Nobody wins" over
   "gritty".
5. One dry joke per screen, maximum. Zero exclamation marks.
6. When the app talks about the user, it observes. It never compliments and never flatters.

**Before / after**

| Surface | Now | Proposed |
|---|---|---|
| Splash | "Your Personal Cinema Journal" | `Selects` — and nothing else |
| Onboarding intro | "Your cinema. Understood. / A few questions to get started." | "Three films you'd rewatch tonight." |
| Movie page CTA | "Ask AI" | The first suggested question, verbatim: "What does the red chair mean?" |
| Similar films | "Similar Films" | "Because of the night" — the shared facet as the heading |
| Import | "Imported" ✓ | "800 films. Here's what they say about you." |
| Log confirmation | "Movie Logged!" | "Circled. 41 this year." |
| Empty watchlist | "No movies yet" | "Nothing queued. That's a choice." |
| Waitlist | "Reach out to the team" | "Not open yet. Leave an email and one line about the last film that wrecked you." |
| Pattern found | "Pattern Detected • 4 films explored" | "You keep choosing men who lose." |
| Recommendation label | "NEXT WATCH" | "Tonight" |

The existing pattern prompt already has the right voice —
*"Ah, the 'morally bankrupt men doing crimes with style' marathon"*
(`ExplorationContext.tsx:66`). That register exists in the prompts and nowhere in the UI
chrome. Make the chrome match the prompts, not the reverse.

---

## 7. The facet vocabulary

This is the fix for the genericness complaint and the prerequisite for the graph, the
progression, and the personalised synopsis. Today the only vocabulary in the system is 19
TMDB genre strings (`useMovieSearch.ts:11-31`), which is why every AI surface sounds like a
streaming service.

**Eight axes. Controlled vocabulary, human-readable, no scores shown to users.**

| Axis | Purpose | Example terms |
|---|---|---|
| `look` | how it was photographed | 35mm grain · anamorphic flare · available light · sodium-and-cyan night · video-tape texture · high-contrast monochrome · Kodachrome warmth · fluorescent institutional |
| `camera` | how the camera behaves | locked-off · handheld verité · dolly-in on faces · unbroken take · god's-eye overhead · zoom-as-punctuation |
| `tempo` | how time moves | slow burn · procedural · breathless · elliptical · real-time · dread accumulating |
| `weather` | moral climate | nobody wins · competence porn · doomed romance · guilt as engine · complicity · dignity under pressure |
| `sound` | the ear | needle-drop maximalism · silence as threat · synth pulse · diegetic only · score as narrator |
| `world` | where it lives | rain-slick city night · sunbaked backroad · institutional corridors · one apartment · the sea · a war with no front |
| `shape` | structure | nonlinear · frame story · chapter cards · ensemble braid · single POV · two-hander |
| `format` | the physical fact | 1.37 Academy · 2.39 anamorphic · IMAX 70mm · 16mm blowup · shot digital, finished on film |

Rules: 4–7 facets per film. Every facet must be a thing a person could *say out loud* at a
bar. If a term needs explaining, it is the wrong term. `format` is the only axis where jargon
is allowed, because there the jargon *is* the pleasure.

**Worked example — your own test case.**

```
Heat (1995)
  look     sodium-and-cyan night · available light
  camera   locked-off · dolly-in on faces
  tempo    procedural · slow burn
  weather  competence porn · nobody wins
  world    rain-slick city night
  format   2.39 anamorphic

The Dark Knight (2008)
  look     sodium-and-cyan night · high-contrast monochrome
  camera   handheld verité · god's-eye overhead
  tempo    procedural · breathless
  weather  competence porn · complicity
  world    rain-slick city night
  format   IMAX 70mm
```

The edge between them is not a number. It is a sentence made of the overlap:

> **sodium-and-cyan night · procedural · competence porn · rain-slick city night**
> *the city is the antagonist and both men are good at their jobs*

That is your "non-geek natural way": the blues, the crime, the heist — stated as the facets
they actually share, in words a person would use.

**Edge weight.** Weighted facet overlap with rarer facets weighted higher — TF-IDF across
the corpus. Two films sharing `heist procedural` score far above two sharing `drama`. This
is explainable, debuggable, instant, and needs no training data. Weight drives line
thickness and opacity in the graph; the number is never shown. Learn weights from behaviour
later, once the Investment fix in `AUDIT.md §6` has produced behaviour to learn from.

**Where facets replace what exists**

- Every prompt currently interpolating `GENRE_MAP` — pattern analysis, Orbit's balanced
  prompt, discover, similar vibes.
- Chips on the movie page, where nothing is rendered today.
- Node colour and edge labels in the graph.
- The active state of the progression: *"three films into sodium-lit crime."*
- The similar-films heading: "Because of the night" instead of "Similar Films".

---

## 8. Motion

The perceived jank is not bad easing. It is that **elements teleport**: the poster in the
onboarding grid, the poster in the confirmation sheet, and the poster on the movie page are
three unrelated DOM nodes that never acknowledge each other. One fix carries most of the
"smoothness" complaint.

### 8.1 The one rule

**The poster is the transition.** Framer Motion is already a dependency; every poster in the
app gets `layoutId={`poster-${movieId}`}`. It then physically travels: grid cell → hero →
day cell → graph node → one-sheet. Nothing cuts.

### 8.2 Tokens

| Token | Value | Use |
|---|---|---|
| `swift` | 140ms, `cubic-bezier(.2,0,.2,1)` | taps, chips, toggles |
| `travel` | 320ms, spring `stiffness 420 / damping 34` | shared-element morphs |
| `settle` | 480ms, spring `stiffness 260 / damping 28` | sheets, screen entry |
| `drift` | 8s, linear, infinite | hero Ken-Burns, graph idle breathing |
| `arc` | 620ms, `cubic-bezier(.65,0,.35,1)` | a dot travelling an edge in the graph |

Nothing in the UI is allowed to change state instantly except text already on screen.

### 8.3 The four canonical transitions

**1. Onboarding morph.** The three chosen posters converge to the centre, overlap, and
collapse into a single card that becomes the verdict. The posters do not fade out; they
*become* the next screen. `layoutId` per poster, `settle`, staggered 60ms.

**2. The log.** Poster leaves the sheet on `travel`, scales to the day cell, lands with a
`medium` haptic, the cell takes the poster's `--film` colour, and the year count ticks up by
one with the numeral rolling. This replaces the invisible navy square and is the single
highest-value animation in the product.

**3. Graph traversal.** A dot leaves the current node, travels the edge on `arc`, and the
edge label types in **once** as it travels — the only place in the app where progressive text
is allowed, because here it maps to physical motion rather than imitating a chatbot. The new
node scales to 1, the old drops to 0.4 opacity. This is the "dots traversing node to node"
you described, and it is what `/dna/:id` should be instead of a hard grid swap.

**4. Hero arrival.** Backdrop paints immediately at full opacity — never a black rectangle.
Video fades in over it across 600ms once buffered. Grain sits above both. Verdict and facet
row are already legible before the video exists. If the video never loads, the screen is
complete anyway.

### 8.4 Haptics

`src/lib/haptics.ts` is built and fires only in Orbit. Wire it everywhere:

| Event | Haptic |
|---|---|
| Log a film | `medium` + `success` |
| Facet chip tap | `selection` |
| Graph node arrival | `light` |
| Orbit swipe | `medium` *(already)* |
| Reached an edge of the graph | `warning` |
| One-sheet ready | `heavy` |

### 8.5 Skeletons, not spinners

There is one centred spinner per screen in this app and that is the strongest "generic web
app" signal in the whole product. Replace all of them: the poster's own dominant colour as a
blurred plate, mono labels in place at 20% opacity, and content filling in. The layout
should never move once painted.

---

## 9. Crossing surfaces

The brief asks for a brand that bleeds through phone, real life, film, cinema, and the web.
One artifact does all five: **the one-sheet.**

`AUDIT.md §4.2` argues monthly should be a poster and annual should be the film. The reason
is that a poster is the same object everywhere:

| Surface | The same artifact |
|---|---|
| **Phone** | end-of-month reveal; saved to Photos; the ring animates as the progress arc toward it |
| **Real life** | printable at A3; sticker sheets of your top facets; a QR that resolves to your graph |
| **Film / cinema** | the vocabulary *is* cinema's — 1.37, 70mm, sodium light. The one-sheet is typeset like a rep-house calendar, not like an app export |
| **Web landing page** | the hero is a live one-sheet of a real user's month, regenerating. The product demos itself with zero screenshots of UI |
| **Social** | it is poster-shaped, so it fills a phone screen when posted; every share is a brand impression rather than a cropped screenshot |

Landing page structure follows from that: one live one-sheet, one sentence, one field. No
feature grid, no phone mockups on gradients, no "How it works" in three columns. The type,
the grain, the ink, and the bone are the entire design — the same system as the app, at
poster scale.

**Print specifics, since real life was named:** the palette is deliberately two-ink, so it
screen-prints. Bone on ink, one hit of grease. That is a $2 poster and a $0.40 sticker, and
it is the cheapest brand distribution a film app will ever have.

---

## 10. What this replaces

| Current | Becomes |
|---|---|
| `#09090b` zinc base | `--ink` `#0B0A08` warm |
| Blue, purple, amber, green, red accents | bone + ink + one rationed `--grease` + `--film` from the poster |
| System font stack | tight grotesk + mono, strictly divided by role |
| `Sparkles` icon, "Ask AI", purple gradients | the question itself, set in mono |
| 19 TMDB genres | eight-axis facet vocabulary |
| Film-strip sprocket icon | the grease-pencil ring |
| Centred spinners | poster-coloured skeletons |
| Hard cuts between steps | poster as shared element |
| Numeric similarity, unshown | facet overlap, shown as a sentence |
| "ViewFindr" / "Selects" / "movielcursor" | Selects |
