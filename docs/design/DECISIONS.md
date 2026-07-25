# Decisions — round 1

Your answers to all 27 questions, converted into locked decisions. Where an answer overturned
something I proposed in rev A, I say so plainly. Where an answer needs a mechanism you didn't
specify, I've proposed one and flagged it.

Four things you said changed the design more than anything else:

1. **The clapstick, not the ring.** Your origin story for the name — reels going to the
   editing room at the end of the day, the editor choosing the takes — gave the whole system
   its vocabulary, not just its mark. §17 below.
2. **Don't delete anything.** This inverts my consolidation plan. Everything gets *promoted*
   into one system instead of removed. §24.
3. **The readiness score is the missing loop.** It resolves the Investment row that was
   scoring zero, because it decays. §1.
4. **The calendar stays on the first screen.** I was wrong; you were describing HomeV2, which
   you already built. §10 and §25.

---

## A. The loop

### 1. The daily reason — **the Ticket** and **Focus**

You want: know what you're in the mood for *without having to describe the mood*. Plus a
readiness score you check to see how your profile has shifted today. Plus 3–4 options —
"your ticket for Tuesday." Plus a reward for choosing one.

**Locked: two objects.**

**The Ticket.** Every day, three stubs. Each stub is a film plus one line naming *why today* —
"it's raining and you have two hours", "you're four films into heist procedurals", "this is
playing at the Angelika at 7:40." Choosing one tears the stub: a physical gesture, a heavy
haptic, and a variable reward on the other side (sometimes a B-side second film, sometimes a
piece of canon nobody told you, sometimes a facet unlocking). Three is the right number —
one guess can be wrong and kill trust, and more than four re-creates the paralysis the app
exists to end.

The stub is also a real-world object, which matters later: it prints, it shares, and it is
already the right shape for the film-tourism check-ins in §26.

**Focus — the readiness score, made honest.**

A film "readiness" number is easy to fake and users smell it immediately. So it should not
measure whether *you* are ready. It should measure **how sharply Selects has you in focus** —
how confident the app is that it knows what you want right now. That is honest, it is
computable, and critically **it decays when you stop logging.**

Visualised literally: your Ticket art is soft when Focus is low and razor-sharp when it's
high. No gauge, no dial — the image itself is the metric. Nothing else on the market does
this and it cannot be screenshotted out of context.

Four contributors, shown the way Oura shows sleep contributors:

| Contributor | Rises when | Decays when |
|---|---|---|
| **Depth** | you import, you log | never — this is your floor |
| **Freshness** | you logged recently | days pass without a log |
| **Clarity** | your recent picks converge on shared facets | you're scattered |
| **Context** | time, weather, local showtimes, runtime you have free | — |

Freshness decaying is the entire loop. It is the first thing in the product that makes
investment load the next trigger, and it is the answer to the Hook row that scored 0.

*Open:* whether Focus is a 0–100 number or a four-state word (soft / settling / sharp /
locked). Question 1 in round 2.

### 2. Push — **yes, and it is the spine**

Confirmed: highly dynamic, personalised, funny enough to be worth the tap. Zomato, Swiggy,
Robinhood as the register.

**Locked: four push types, and no others.**

| Type | Fires | Example |
|---|---|---|
| **The Ticket** | once daily, at an hour the user sets | "Tuesday's ticket. Three, and one of them is a reach." |
| **The Verdict** | 10–15 min after a film should have ended (§4) | "So. Did the ending earn it?" |
| **The Drop** | when a film they'd want appears near them or on a service they have | "Heat. 70mm. Four blocks away. Sunday." |
| **Focus decay** | rarely, and only with something to offer | "You've gone soft. Two logs and I'll have you sharp again." |

Hard rule: one push a day is the default and the ceiling is two. The funny register only
works because it is rare. Zomato gets away with volume because the purchase is impulsive and
cheap; a film is two hours and a wrong nudge is expensive.

### 3. Sessions — **two lanes, and Rabbit Hole ships as a mode**

You liked the reframe and want it as a beta mode rather than the whole app. Agreed, and it
resolves the speed-vs-stickiness tension cleanly.

**Locked:**
- **Fast lane** — the Ticket. 90 seconds. Default.
- **Deep lane** — **Rabbit Hole**, opt-in, unbounded, and it *pays out*: every rabbit hole
  session ends by handing you a recommendation that could only have come from that specific
  wander. That exit reward is what makes the mode worth entering, and it is what stops a
  rabbit hole from being a time sink the user regrets.

Orbit is already the Rabbit Hole engine. It gets renamed and promoted, not rebuilt.

### 4. The 11:40pm moment — **owned**

Confirmed, and you were more specific than I was: the push should ask about the film, then
open a door — "did you know this scene was inspired by…" — and that door leads into the DNA
graph, collaborator by collaborator. Tom Hardy → Nolan → Cillian Murphy → Peaky Blinders. The
*Blink Twice* spiral: what does this signify, were they running, what did they forget.

**How the app knows a film ended.** You never said, and it's the load-bearing mechanism.
Three signals, in order of reliability:

1. **The Ticket was torn.** They picked it at 9:15, runtime is 170 minutes, so the push fires
   at 12:10. This is exact and free — you already have runtime.
2. **A calendar log dated today.** Add a start time to the log and you have the same maths.
3. **Manual "watching now."** One tap from the film page.

None of these require guessing, and the first one is the strongest argument yet for the
Ticket: **it is the only feature that tells you when someone is inside a film.**

**Then the reward.** You want: after they tell you, offer three more. And you were emphatic
that genre/sub-genre nearest-neighbour is stale and everyone knows it. Correct — and it is
exactly what ships today. The three follow-ups come from the facet system in §5, each with
its reason stated: not *"similar films"* but *"three more where the city is the antagonist."*

---

## B. Taste and taxonomy

### 5. Who writes the facets — **hybrid, in two layers**

First, the thing you asked me to explain.

> **What a "seed corpus" actually is.** It is a spreadsheet. About 300–500 well-known films,
> each with its facets filled in by hand — *Heat: sodium-and-cyan night, procedural,
> competence porn, nobody wins, 2.39 anamorphic.* You never ship that spreadsheet to users.
> You paste a few dozen relevant rows into the prompt every time you ask the model to tag a
> new film, so it copies the vocabulary instead of inventing new words. That's the whole
> trick. Without it, the model says "atmospheric" on Tuesday and "moody" on Wednesday for the
> same film, the tags never repeat, and nothing can be computed on them. With it, the
> vocabulary stays stable and the graph becomes possible.
>
> It is not about your personal taste being imposed on users. It is about the *words* being
> consistent. Which films the user gets is entirely personal; what the words mean is not
> allowed to drift.

**Locked: two layers, which is exactly the hybrid you described.**

**Layer 1 — the ground truth.** Shared by every user. Each film is tagged once, cached
forever, using the seed corpus as few-shot examples. Same film, same facets, for everyone.
This is what the graph computes on. Cheap after the first pass and it never drifts. Your
option (a), fixed by your instinct that outputs shouldn't vary.

**Layer 2 — your words.** How those facets get *named and phrased for you*, learned from your
behaviour and your own language. Two users looking at the identical underlying edge read two
different sentences. This is where the personalisation you insisted on lives, and it is
where a user's tags can surprise them without the maths ever becoming mush.

**Feedback, as you asked.** Every facet is long-pressable: *wrong / not why I liked it.* That
does two jobs — it repairs the tag, and the correction is itself the highest-quality taste
signal in the product, because the user is telling you *why* rather than *what*.

**Who writes the seed rows.** You said you're willing but you doubt users will be. They
shouldn't have to and they won't be asked. You write a few hundred rows once; users never see
that surface. Their contribution is the long-press correction, which costs them nothing.

Also locked from your answer: **film only at first, no TV.** And logging continues after
import, because Letterboxd doesn't hold everything.

### 6. Fixed or open — **closed spine, open surface, and every facet is a destination**

You want a closed list *and* the community's own language. You pointed at Spotify's
"Folding Clothes Sad Mix" and at the Letterboxd third-party genre lists, and you want tags to
be somewhere people can click through to more films.

**Locked:**
- The **spine** is closed. Eight axes, controlled terms, because the graph has to compute.
- The **surface** is open. What a cluster gets *called* for a given user is generated and can
  be as strange as it is accurate.
- **Every facet is a place.** Tapping a facet opens a room full of films that share it, with
  a name written for you. That is the Spotify-daylist mechanic, and it is also the "subsets
  of subsets of subsets" you originally asked for — you get there by tapping two facets, then
  three.

### 7. How sharp — **80 / 20**

Locked. Four in five reads are warm and useful; one in five is the uncomfortable one. The
sharp ones are confined to two places, both of which the user chose to open: the profile
insights, and the import reveal. A sharp read never appears unrequested on a film page.

### 8. Does the graph include unseen films — **yes, that's its job**

To answer your question: the graph is the **Assembly** — every film you've logged, laid out
and connected, extending outward into films you haven't seen.

Your Guy Ritchie example is the most useful thing in your whole answer. You'd exhausted the
filmography, so you had to write *a paragraph describing what you actually liked* to get to
*Seven Psychopaths*. That paragraph is the facet system in plain English, and it is the
proof that genre-adjacency was never going to find it.

**So it becomes a feature.** On any film: *"what did you like about this?"* — free text, one
line. It's the single richest signal available, users give it willingly because it feels like
talking rather than rating, and it feeds Layer 2 directly.

Locked: seen films are solid and carry their own poster colour; unseen are outlined and
colourless until logged. Logging fills one in. **Your map visibly grows when you log** —
which is the reward the calendar has never paid.

### 9. Two identical tastes — **the wallet, the usage shape, and the weather**

Three differentiators, from your answer:

1. **The wallet** — the handful of films that are close to your heart. Small, ranked, yours,
   and it anchors the whole graph. Locked as a real object.
2. **Usage shape.** Your Spotify point: you and your friend match at 99% and use completely
   different features. So the Assembly should render differently depending on how you use it
   — someone who lives in Rabbit Hole gets a map dominated by their paths; someone who logs
   compulsively gets one dominated by density.
3. **Tonight is contextual.** Weather, time, day, what's playing near you. Two identical
   tastes get different Tickets on the same Tuesday.

---

## C. Calendar and logging

### 10. Logging is load-bearing, and the calendar stays home — **I was wrong**

You want the calendar on the first screen, enhanced: a video carousel with the film's logo in
front, a date strip below with sprocket-like detents and haptics on the scroll.

That is `HomeV2.tsx`. You described your own unrouted prototype. **Locked: wire HomeV2, add
the carousel and the detented strip.** My rev A recommendation to demote the calendar is
withdrawn.

Also locked:
- **Widgets, iOS and Android**, for one-tap logging from the home screen. This is a second
  external trigger channel and it costs almost nothing next to push.
- **Log the film *and* the moment.** Your *Days of Thunder* note — no F1 films without it —
  is the kind of thing the app should hold. A log has an optional line. Those lines are the
  most personal thing in the product and eventually they are what the Cut is narrated by.
- **More haptics everywhere.** Currently they fire only in Orbit.

### 11. Ratings — **ask for them**

Locked. Your reasoning is right and I'll restate it because it should govern more than this
decision: inferred signals compound their own error, and a taste layer built on layers of
inference has an error rate that grows with depth. Explicit ratings are the ground truth that
stops the drift. Selects differentiates on *what it reads into* the rating, not on refusing
to ask for one.

### 12. The 400th film — **the Strip, zoomable; and perks**

Locked:
- The calendar becomes **the Strip** and zooms like iPhone Photos: day → month → year →
  everything. At year scale it is the contribution-graph texture you described, except each
  day is a slanted bar carrying that film's colour.
- **Perks at thresholds.** AMC/Regal/independent tickets. Worth saying plainly: this is a real
  cost line and a partnership conversation, not a feature flag. Milestones that cost nothing
  — a Print, a rare facet, an early Cut — should carry the loop until a partner exists.

---

## D. Import

### 13. The import reveal — **count, then Explore, then the Assembly**

Locked sequence:

1. A checkmark and **"856 films imported."** Not "Imported."
2. One number-forward line with a creative equivalence — hours converted into something
   absurd and true.
3. An **Explore** button. Nothing else competes with it.
4. Explore opens the Assembly, built. If it isn't ready, it says so and pushes when it is.

The reveal itself carries the sharp reads from §7: time-of-day patterns, dominant colour
across your posters, the brothers observation, and the blind spots — including the ones
nobody would guess, your purple-posters example. Not "favourite director, favourite genre."

*One flag:* "favourite colour across your films" requires sampling every poster you've ever
logged. Very doable, genuinely novel, and cheap if done once at import.

### 14. Ratings and username-only import — **both, in that order**

You want ratings, and you want it pictureless: username, nothing else.

**Honest technical position.** Letterboxd has no public API for full history. What a username
alone gets you instantly is the public RSS feed: the most recent diary entries *with ratings*
— roughly the last 50. Full history still needs the CSV export.

**So: username first, CSV second.** Username gives an instant, frictionless, genuinely
impressive reveal off recent films. Then, on the other side of that reveal, once they already
believe you: *"that was your last fifty. Want me to read all 856?"* CSV becomes something
they want to do rather than a chore you demanded up front.

### 15. No Letterboxd — **swipe to calibrate**

You want multi-select favourites, and a fast cold start by swiping through films — but you
correctly noted that "watched" alone isn't enough signal.

**Locked: one gesture that carries both facts.** A poster, four directions:

| Direction | Means |
|---|---|
| **Right** | seen it, loved it |
| **Left** | seen it, didn't land |
| **Up** | haven't seen it, want to |
| **Down** | haven't seen it, not for me |

Every swipe is two bits instead of one, it is faster than tapping, and it is the same gesture
vocabulary as Rabbit Hole — so the cold start is teaching the app's core motion at the same
time as it's building the graph. Around forty swipes is a usable Assembly.

Your spherical-web search idea is noted and specified in `DIRECTION.md`; it is the same
Assembly renderer with a query at the centre, not a separate build.

---

## E. Aesthetics

### 16. Colour — **I asked the wrong question**

You rejected the warm-versus-cool framing outright and described something better: dark, multi-
coloured, colour-agnostic, with reactive flares — the new Gemini app's behaviour — and
cultural rather than clinical.

**Locked:** the shell is a near-neutral dark that stays out of the way. **All chroma comes
from the films**, and it *moves in response to touch*. Poster colour bleeds into the surface
under your thumb, the Ticket's colour is the colour of the film it's offering, the Assembly is
lit entirely by the films in it. `extractDominantColor` already exists; it currently powers
one background wash. It becomes the entire palette.

I'll make the small call myself so it stops taking up space: base `#0A0A0B`, near-neutral
with a hair of warmth, chosen because it doesn't tint poster colour. Rev A's argument about
photochemical-versus-streaming is withdrawn.

### 17. The mark — **the clapstick. You were right and I was wrong.**

Your objection to the ring was correct: Criterion owns a circle, and a ring is not
differentiating. Your instinct — the clapperboard, specifically the diagonal bars on the
clapstick — is much stronger, and your origin story is why.

> The reels come to the editing room at the end of the day. The editor chooses which takes
> live. Choosing the right film to watch tonight matters more than it ever has, because time
> is short and there is a great deal of slop.

**Locked: a set of six diagonal bars, with exactly one in the accent colour.**

Not a clapperboard. Just the clapstick's stripes, abstracted — which reads as cinema
instantly, survives at 60px because it's pure high-contrast diagonal, and cannot be confused
with a ring, a circle, a play triangle, or a film strip.

The one accent bar is the whole idea: **six takes, one selected.** That is the name, drawn.

And unlike the ring, the bar is the atom of the entire system:

| The bar becomes | Where |
|---|---|
| the mark | six bars, one lit |
| a day | the date strip, detented, one bar per day |
| a year | 365 bars, each carrying that film's colour |
| a rating | five bars, lit |
| progress | bars fill left to right |
| a rule | a run of small bars instead of a hairline |
| the launch | the bars clap shut, with the haptic |

One shape, seven jobs, and it produces the sprocket-detent date strip you asked for in §10 as
a by-product rather than as a separate design.

### 18. Typeface — **ship free now, license later**

Locked: **Archivo Variable** for display, **Martian Mono** for specs. Both free, both on
Google Fonts, both shippable today. Archivo's width axis is the reason — you can go from
condensed to expanded on one file, which is the poster move, and it does not read as a
default the way Inter does. Budget Diatype or Söhne for the rebrand pass.

### 19. Reference — **Criterion sleeve × techno flyer. Lab report is dead.**

Rev A leaned mono-heavy and cold; you rejected that. Mono is demoted to specs and facet chips
only — present, never dominant.

And you named the governing principle yourself without calling it one: *"when you display
Mission: Impossible, the movie logo is doing most of the talking, because that's what it's
meant to do."*

**Locked as the core rule of the system: Selects is the mount, not the picture.** The chrome
is quiet, precise and confident; the films are loud. That is how maximalism and minimalism
coexist — the maximalism is borrowed from the films and the restraint is all ours. The app
already fetches TMDB logo images and uses them on the detail hero. That should be everywhere.

### 20. How much it talks — **reactive, not running**

Locked. Text arrives already written. It reacts to what you just did rather than animating for
its own sake. Your Cursor reference is the exact pattern and it gets built:

**The Nudge** — after three circling searches, a bar rises: *"You're three deep in heist
procedurals. Rabbit hole?"* with a five-second ring that acts if you don't dismiss it. Present,
smart, interruptible, gone if ignored.

`PatternAssistant` is already 70% of this. It becomes the Nudge.

---

## F. Sharing

### 21. The Cut — **you were right about the format; I was right about the cost**

Your Amazon Prime slate analogy landed: dialogue and scenes cut together, title in the corner.
For someone logging 20–25 films a month that's a genuinely personal trailer, and a still
poster doesn't carry it.

**Locked as a ladder, so it ships and stays affordable:**

| Rung | What | Who gets it |
|---|---|---|
| **the Print** | a still one-sheet | everyone, every month |
| **the Cut** | 20–30s cut of clips, dialogue and title cards | anyone who logged enough that month |
| **the Year** | the long one | December |

Making the Cut *earned* solves two problems at once: it controls render cost, and it turns
logging into the thing that unlocks the artifact — a fixed-ratio reward on the exact behaviour
you need. The naming is from your own §17 story: a cut is what the editor assembles from the
selects.

*Flag:* clip usage is a rights question. Trailer footage is promotional and widely tolerated;
feature footage is not. Build the Cut from trailers, stills and logos.

### 22. The Assembly is public — **by default, private on request**

Locked. Shareable at any time horizon — a week, a month, a year — each as its own Print. No
per-platform share buttons; one image, one long-press, the OS sheet.

### 23. Social — **taste match first, group chat later**

Locked for now: visiting another profile shows a **match percentage**, top right. It's cheap,
it's the highest-value social object in the category, and it's the thing people screenshot.
Shared watchlists stay as they are and get notifications so the tribe reward stops being zero.
Nothing else until the match number proves people care.

---

## G. Scope

### 24. Nothing gets deleted — **plan inverted**

Understood, and the plan changes accordingly: **promote, don't remove.** Every existing
surface keeps its route and gets a job inside one system.

| Today | Becomes | Deleted? |
|---|---|---|
| `MovieCalendarApp` `/app` | **the Strip** — zoomable timeline | no, re-routed |
| `HomeV2` (unrouted) | **home** — carousel + date strip | no, wired up |
| `OrbitScreen` `/orbit/:id` | **Rabbit Hole** mode | no, renamed |
| `DNAScreen` `/dna/:id` | a view inside **the Assembly** | no |
| Profile Taste DNA | **Focus** + Assembly entry | no |
| Saved Vibes | saved **facet rooms** | no |
| `PatternAssistant` | **the Nudge** | no |
| `/watched` `/watchlist` `/liked` `/vibes` `/lists` | facet rooms and Bin views | no |
| Handle claim ×3 | one keeps priority; others stay dormant | no |

All work happens on a branch. Nothing lands on `features` without you seeing it.

### 25. HomeV2 — **wire it**

Confirmed unfinished rather than abandoned. It becomes home, plus the video carousel, the
logo-forward hero, and the detented date strip.

### 26. User zero — and **Selects Maps**

The segment is locked as described: people who log, who care what format a film was shot in,
who want to connect films to each other, Letterboxd-native first and manual second.

You then described a whole second product — film tourism. Walking through LA and getting told
you're seventy-three feet from where De Niro and Pacino had coffee. Photo check-ins. Rewards.
IMAX scarcity and people travelling for *The Odyssey*.

**Not designed here.** But three decisions above were made so this stays cheap when you want
it, and it's worth knowing they were deliberate:

- The **`world` facet axis** already carries location as a first-class property of a film.
- The **Ticket stub** is already a check-in object with a place and a time on it.
- **"What's playing near you"** as a Focus contributor means the app already knows where you
  are and what's around you.

When Selects Maps happens, it inherits all three rather than starting over.

### 27. Thirty days — the one sentence

Yours, condensed:

> **Thirty days in, they stop opening Instagram, X and IMDb for film — because Selects is
> where the film conversation, the logging habit and the artifact about themselves all live.**

Two operational consequences, both locked:

- **"Why watch this" is the most important thing on a film page** and is currently the least
  visible thing on it. The one-liner is generated today and buried under three rows of
  buttons. It goes to the top.
- **Canon gets surfaced contextually.** Universally-known film facts on the pages where they
  belong. The infrastructure exists — `knownForTags` are generated and rendered nowhere.

---

## What this changes in the roadmap

Reordered against the answers. Dependency order, no dates.

**First — close the loop.** Focus and its decay, persisted exploration, one push channel, the
Ticket. Nothing else matters until a user has a reason to come back tomorrow.

**Second — own 11:40pm.** Runtime-timed Verdict push, the log, the three follow-ups with
reasons, and the door into the Assembly.

**Third — the vocabulary.** Seed corpus, Layer 1 tagging, Layer 2 phrasing, long-press
correction, and facets as tappable rooms. This is what makes everything above stop sounding
generic.

**Fourth — the front door.** HomeV2 wired, carousel, detented strip, and un-hiding the
personalisation that already exists but has never been rendered.

**Fifth — identity.** Clapstick, bar system, Archivo, reactive colour, one name.

**Sixth — the artifacts.** Import reveal, the Print, the Cut, public Assembly, match
percentage.

**Banked:** Selects Maps, perks partnerships, TV.
