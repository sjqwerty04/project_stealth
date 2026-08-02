# Selects — Full UI/UX Audit

> **Status:** the findings below stand as written. The *recommendations* have since been
> superseded in three places by your answers — see [DECISIONS.md](DECISIONS.md). Specifically:
> §4.1 (the calendar stays on the first screen), §4.2 (the monthly video survives, as an
> earned rung on a ladder), and §3.7 / §6 (nothing gets deleted; surfaces are promoted into
> one system instead). Those sections are annotated inline.

Reviewed at commit `ba07af6` (`features` branch). Static source review of all 20,852 lines
of `src/` and `api/`, plus every shipped brand asset in `public/`, plus runtime screenshots
of `/login` and `/onboarding`, plus frame-by-frame analysis of `BUG.mov` (an 82-second phone
recording of the logging flow).

Evidence images live in `./assets/`. Every claim below cites `file:line` or a frame.

---

## 0. The verdict

**Hook Model score: 4/10.** The loop does not close. Nothing in the product creates a
reason to open it tomorrow, and the one thing users invest — their exploration history —
is stored in React state and destroyed on reload.

Five findings, in order of how much they cost you:

1. **The reward for the core action is an invisible dark blue square.** A user searches,
   finds *The Naked Gun*, taps **Add to Calendar** — and the payoff is day `22` turning a
   slightly different shade of near-black. No poster. No animation. No sound. No haptic.
   See `assets/current-logged-reward.jpg`. Cinema's most emotionally loaded asset — the
   poster — is fetched, rendered in the confirmation sheet, and then thrown away at the
   exact moment the user has earned something. This is the single highest-leverage fix in
   the product and it is roughly one component.

2. **The app forgets you.** `ExplorationContext` holds `clickedMovies` in `useState`
   (`src/contexts/ExplorationContext.tsx:132`) and never persists it. The "arithmetic
   progression that builds as they search" you described already exists in spirit — and it
   is deleted on every reload. Nothing else loads a next trigger either: there is no push
   notification code, no email, no FCM, no widget, no streak, no recap anywhere in the
   repository. Grep confirms zero matches for `streak|wrapped|recap|rewind` in `src/` and
   `api/`.

3. **Your genericness complaint has a single root cause, and it is 19 strings long.** The
   only taste vocabulary that ever reaches an LLM is TMDB's genre list —
   `GENRE_MAP` in `src/hooks/useMovieSearch.ts:11-31`. Pattern analysis feeds Claude
   `- Title (Year) [Crime, Drama]` (`ExplorationContext.tsx:152-154`). Orbit's balanced
   prompt injects `Genres: {genres}` from the same map (`src/lib/orbitEngine.ts:59-63`).
   You are asking a film scholar to find "subsets of subsets of subsets" while handing it
   *Action, Thriller, Sci-Fi*. It cannot. Meanwhile the app **already generates** exactly
   the micro-tags you want — `api/reddit-context.ts:27` produces things like
   `"Zoë Kravitz's directorial debut"`, `"divisive third act"` — and never renders them.

4. **"Similar in terms of what?" — the answer is computed and then discarded.**
   `useSimilarVibes` asks Claude for films *with reasons* and returns them; the movie page
   renders poster + title + year only (`src/screens/MovieDetailScreen.tsx:589-590`). The
   `overview` and reason data are on the type and unused. Same story for
   `vibeDescription` (generated at `useMovieDetails.ts:252-274`, never rendered),
   `knownForTags`, `watchProviders`, and the chat's `taste` prop, which is hardcoded
   `undefined` at `MovieDetailScreen.tsx:757`. There is a personalization layer in this
   codebase that users have never seen.

5. **The identity is not just weak, it is literally invisible.** Open
   `public/pwa-512x512.png`: the app icon is dark-grey film sprockets on pure black. On an
   iOS home screen it reads as an empty rectangle. `selects-logo.png` is a 273×58 raster
   with a black box baked behind the wordmark, so on the `#09090b` login screen it renders
   as a visible dark rectangle around the type (`assets/current-login.png`). The product
   ships under three names simultaneously: `ViewFindr` (`public/manifest.json:2`),
   `Selects` (`vite.config.ts:26`), `movielcursor` (`package.json:2`), with a
   `movielove_trending_cache_v1` localStorage key for good measure
   (`MovieCalendarApp.tsx:49`).

Everything else in this document is detail underneath those five.

**One reframe before the detail.** You said two things that fight each other: *"helps
users find films as fast as they can"* and *"the app needs to be sticky, keep users where
they are."* An app that succeeds at its stated job ejects the user — to a couch, to a
theatre. That is also true of the Oura app you cited: Oura's job is that you sleep, not
that you scroll. So stickiness here cannot come from session length. It has to come from
**return frequency and identity**. The target to design against is *two sessions a day at
90 seconds*, not one session at twenty minutes. That single reframe changes what is worth
building, and I have used it as the standard throughout.

---

## 1. What the app actually is right now

| Route | Screen | What the user gets |
|---|---|---|
| `/` | `SplashScreen` | Wordmark + "Loading..." spinner + "Beta v0.1" |
| `/login` | `LoginScreen` | 4-step email/whitelist gate |
| `/onboarding` | `OnboardingScreen` | 7 hard-cut pages |
| `/app` | `MovieCalendarApp` (1,958 lines) | Month grid of empty squares |
| `/discover` | `DiscoverScreen` | Search + floating pattern panel |
| `/movie/:id` | `MovieDetailScreen` | 60vh muted trailer, badges, TMDB synopsis, 3-col similar grid |
| `/dna/:id` | `DNAScreen` | Breadcrumb + grid of cast/crew headshots |
| `/orbit/:id` | `OrbitScreen` | Directional swipe deck + 2D constellation |
| `/profile` | `ProfileScreen` | Stats + three AI sentence cards |
| `/watched`, `/watchlist`, `/vibes`, `/liked`, `/lists` | five more list screens | — |

**The opening screen, precisely.** `assets/current-home-calendar.jpg`: a header that says
"Movie Plan / DARK MODE CALENDAR", a month navigator, and 30 empty rounded squares. The
current build renames the header to "Selects / YOUR CINEMA JOURNAL"
(`MovieCalendarApp.tsx:1114-1115`) but the composition is unchanged. The recommendation
card — the only thing on this screen that answers "what do I watch" — is rendered *below
the entire month grid* at `MovieCalendarApp.tsx:1334-1352`, off-screen on every phone.

You described this as "the first thing I see is a calendar." It is worse than that: it is
a calendar that is empty by definition for a new user, on a product whose promise is speed.
The first screen of a consumer app is the entire pitch, and this one pitches *data entry*.

**The logging flow, precisely.** From `BUG.mov`:

- `0:48` — bottom sheet "Plan a Movie / Saturday, Nov 22", poster of *The Naked Gun*,
  "Who is watching? → Just Me / Watch with a friend", white **+ Add to Calendar** button
  (`assets/current-plan-sheet.jpg`). This sheet is the best-composed surface in the app.
- `0:54` — sheet dismisses. Day 22 is now a `#201c3a → #0d1531` radial wash
  (`MovieCalendarApp.tsx:151-154`, `1300`) at roughly 44×44px
  (`assets/current-logged-reward.jpg`).
- That is the whole reward.

There is no `AnimatePresence`, no shared-element transition from the sheet's poster into
the day cell, no haptic (`src/lib/haptics.ts` exists and is called from Orbit only), no
confetti-equivalent, no "you're 12 films into 2025" — nothing. Framer Motion is a
dependency and is not imported by a single file in the auth, home, or onboarding path.

**Onboarding, precisely.** Seven pages, all hard-cut via `if (page === N) return`
(`OnboardingScreen.tsx:190-426`). No `AnimatePresence`, no shared element, no morph. The
progress dots are `transition-colors` only (`:153`). Pages 5 and 6 ask for a Letterboxd
username and an IMDb CSV **before the user has ever seen a recommendation** — investment
requested before any reward has been delivered, which is the single most common way
onboarding funnels die. And it is bypassable: Google sign-in and returning sign-in route
straight to `/app` (`LoginScreen.tsx:67-68`, `115-121`), so a meaningful share of users
have no taste profile at all and the app has no idea.

---

## 2. Hook Model diagnostic

Scored per the four Quick Diagnostic rows, 2 = fully satisfied, 1 = partial, 0 = absent.

| Row | Score | Evidence |
|---|---|---|
| **Internal trigger identified** | **1** | A real emotion is adjacent — 9pm, two hours free, refusing to waste them — and `RecommendationCard` gestures at it. But nothing is designed against it: the recommendation is below the fold, the home screen answers "what did I watch" instead of "what do I watch", and there is **zero** external-trigger scaffolding to bootstrap the association. No push, no email, no widget, no lock-screen surface anywhere in the repo. |
| **Action is dead simple** | **1** | The action exists but is obstructed at every step. New user: 4 login taps → 7 onboarding pages → a calendar. Logging from home: tapping an empty day **ejects you off `/app` to `/discover`** (`MovieCalendarApp.tsx:800-802`) rather than opening in place. `RecommendationCard` presents 6 competing choices on one 96px card — Like, Pass, Skip, Add, Refresh, and whole-row navigation (`:176-224`) — a textbook Hick's Law violation. Three separate entry points to search (header icon, bottom FAB, empty-day tap) with different behaviours. |
| **Reward is variable** | **1** | Genuine hunt variability exists and it is the best idea in the product: Orbit's four directional axes with AI-written connection reasons (`orbitEngine.ts:19-63`), and the pattern insight at 3+ clicks. But it is buried behind a purple gradient button on a detail page, the reward for the *core* action is the invisible navy square, tribe reward is absent (shared watchlists exist with no notification when anyone acts on them), and self reward is absent entirely (no streak, no recap, no visible taste growth). |
| **Investment loads next trigger** | **0** | Provable. `ExplorationContext.clickedMovies` is `useState` (`:132`) — the exploration graph is destroyed on reload. `saveVibe` is the only write and it goes to a screen nobody returns to. Imports of 800 Letterboxd films change nothing visible. And even a perfect investment could not load a trigger here, because **there is no trigger channel to load**. |

`round(3 / 8 × 10)` = **4/10**.

**Ethics gate: Facilitator.** The maker is plainly a cinephile who uses this, and helping
people spend two hours on a film they'll love genuinely improves a life. No cap applies.
Worth stating explicitly, because the correct move for this product is *not* engagement
maximisation — it is making the two 90-second sessions excellent. Infinite scroll would be
the wrong instinct here, and none of the recommendations below add one.

**Blocking 10/10, in dependency order:**

1. The Investment row is at 0 and everything else is downstream of it. Persist the
   exploration graph, make logging visibly grow something, and give the user an artifact
   they own.
2. There is no trigger channel. Until something can reach the user's lock screen or their
   Sunday, the loop is open by construction.
3. The reward for the core action must be worth the tap.
4. The action must be reachable without a month grid in front of it.

---

## 3. Craft audit

### 3.1 Identity — severity: critical

| Finding | Evidence |
|---|---|
| App icon is near-invisible: dark grey sprockets on `#000` | `public/pwa-512x512.png`, `selects-icon.png`, `apple-touch-icon.png` |
| Wordmark PNG has an opaque black plate baked in, visible as a rectangle on the dark UI | `public/selects-logo.png` (273×58), rendered `h-10` at `LoginScreen.tsx:139`; see `assets/current-login.png` |
| Raster logo at 273px wide is upscaled on 3× displays | same |
| Film-strip/sprocket motif is the most-used cliché in the category and is semantically wrong — the product is about taste, not celluloid | — |
| Three product names shipping simultaneously | `public/manifest.json:2` (ViewFindr), `vite.config.ts:26` (Selects), `package.json:2` (movielcursor) |
| Two PWA manifests in the build; `public/manifest.json` is deployed but unlinked, so a stale "ViewFindr" file ships on every deploy | `index.html` has no manifest link; `vite-plugin-pwa` injects its own |
| Third-party logos shipped at absurd sizes: `imdb-logo.png` is a **JPEG** misnamed `.png` at 2048×1008 / 53KB; `rt-logo.png` is 1436×416 / 67KB — for badges rendered at ~16px | `public/` |
| Two taglines in circulation | "Your Personal Cinema Journal" (`SplashScreen.tsx:29`) vs "Your Cinema Journal" (`MovieCalendarApp.tsx:1115`) |

The name **Selects** is genuinely good and I would keep it. It is an editing-room term —
the takes the editor pulled — so it is insider without being cute, and it describes the
product's actual job. `ViewFindr` is a 2014 startup name with a dropped vowel; retire it
today. The mark is the real gap and `DIRECTION.md` proposes one.

### 3.2 Colour — severity: high

The base surface is `#09090b`. That is Tailwind `zinc-950`, the single most-used dark-mode
default in existence; it reads "shadcn template", not "cinema". Around it:

- Blue for focus, links, "Next Watch", today's date (`blue-400`/`blue-600`)
- Purple for onboarding selection, Orbit, AI surfaces, chat bubbles (`purple-500`/`600`)
- Amber for waitlist and pending reviews (`amber-500`)
- Green/red for ratings
- A blue `#2563eb` global banner for handle-claiming (`ClaimHandleBanner.tsx:92`)
- Per-movie radial gradients on calendar cells (`MovieCalendarApp.tsx:151-154`)

Six accent families, zero tokens, hexes inline across files. Two specific consequences:

**Purple is now the universal "an LLM lives here" signal.** You explicitly want an app that
is full of AI and doesn't look like it. Purple gradients plus `Sparkles` icons plus a button
labelled **"Ask AI"** (`MovieDetailScreen.tsx:459-465`) is the exact opposite. It announces
the machine on every screen.

**The one genuinely good colour instinct is under-used.** `extractDominantColor` samples the
poster (`OrbitScreen.tsx:69-116`) and the calendar derives per-film accents — that is
correct thinking. It is spent on a background wash in one screen and 44px squares in another.
Poster-derived colour should be the app's entire chromatic system.

### 3.3 Typography — severity: high

`src/index.css:22` sets the system stack and `index.html` loads **no webfont at all**. The
product has no typographic voice. Every heading is `font-bold` or `font-black` Helvetica/
Roboto at `text-xl`–`text-3xl`. Every section label is `text-sm text-gray-400 uppercase
tracking-wider` — the same label treatment on the movie page, profile, DNA, and discover.

There is no type scale, no numeral discipline (`tabular-nums` appears once, in
`RatingBadges.tsx`), and no monospace anywhere — despite you wanting technical specs,
aspect ratios, and formats to be first-class, which is exactly what a mono is for.

The one deliberate typographic gesture in the codebase is the DNA wordmark:
`font-extrabold tracking-[-0.12em]` (`MovieDetailScreen.tsx:376`). That negative tracking
is the right instinct and appears nowhere else.

### 3.4 Motion — severity: high

You said "it's not smooth enough either." It isn't smooth because outside of Orbit there is
essentially no motion design.

| Surface | Current | Should be |
|---|---|---|
| Onboarding pages 0→6 | `if (page === N) return` hard cut | shared-element morph; the selected poster is the transition |
| Login steps | conditional render, instant | the field morphs, layout stays put |
| Month change | instant grid swap | directional slide with the grid as a single layout unit |
| Log a film → calendar | nothing | poster flies from sheet into the day cell |
| Synopsis expand | instant text swap, layout jump (`MovieDetailScreen.tsx:493-499`) | height animation |
| Recommendation refresh | content swaps in place | crossfade or card deal |
| Modals | `{open && …}`, no enter/exit | spring in, drag to dismiss |
| DNA node change | instant swap (`DNAScreen.tsx`) | dot travels along the edge — the thing you actually asked for |
| Route changes | none | shared poster element between grid, detail, orbit, DNA |

What motion does exist is Tailwind utilities: `transition-colors`, `animate-spin`,
`animate-pulse`, `animate-in slide-in-from-bottom-full duration-300`, and a few
`active:scale-95`. Orbit is the exception and proves the team can do it — real springs
(`stiffness: 500, damping: 30`, `OrbitCardStack.tsx:110-123`), a shatter transition
(`ParryTransition.tsx:16-84`), and haptics wired per gesture (`OrbitScreen.tsx:169-180`).
That quality bar exists in exactly one subsystem.

Two systemic gaps: **there is no shared-element transition anywhere in the app**, and
**haptics fire only in Orbit** despite `src/lib/haptics.ts` being ready.

### 3.5 Perceived performance — severity: high

Speed is a brand attribute for you, so these are brand bugs:

- **Movie page blocks entirely on first paint.** `isLoading` gates the whole screen behind
  a centred spinner until TMDB details, credits, videos, providers, images, external IDs
  *and* an OMDb round trip all complete (`MovieDetailScreen.tsx:286-291`,
  `useMovieDetails.ts:94-229`). The user tapped a poster; the app owed them that poster
  instantly as the hero and everything else progressively.
- **Similar films pop in late and reflow the page.** Claude call → N× TMDB search per title
  after the page is already visible (`useSimilarVibes.ts:78-166`).
- **Orbit entry fires up to four Claude calls plus four TMDB search+details rounds** per
  film (`orbitEngine.ts:338-343`). Fast when prefetch wins, visibly slow when it doesn't.
- **Orbit back navigation leaves stale prefetch**: `goBack` doesn't clear `prefetchedMoves`
  (`orbitStore.ts:180-194`), so the directional indicators can lie until the next forward
  swipe.
- **Profile blocks on Claude** before showing any stats (`useUserInsights.ts:48-121`).
- **Discover replaces the whole result list with a spinner** on every query instead of
  streaming results in.

There is no skeleton anywhere in the app except three pulses on the profile screen. Every
other load is a centred spinner — which is the "generic web app" tell more than any other
single detail.

### 3.6 Taxonomy and copy — severity: critical

Covered in §0.3. The complete inventory of taste vocabulary in the product:

| Layer | Vocabulary | Specificity |
|---|---|---|
| Search cards, orbit cards, all AI prompts | TMDB `GENRE_MAP`, 19 strings | generic |
| Movie page | **no tags rendered at all** | — |
| Known-for line | 7-word audience hook (`api/movie-known-for.ts:8`) | medium |
| Reddit micro-tags | noun phrases, genuinely specific | **never rendered** |
| Orbit connection reason | ≤8 words, references source film | medium-high |
| Profile Taste DNA | 3 AI sentences | high, but prose not structure |

Copy debt worth naming: **Orbit's four directions are labelled three different, mutually
contradictory ways.** The engine maps UP to `visual`/cinematography
(`orbitStore.ts:4-6`, `orbitEngine.ts:19-23`); the onboarding overlay tells the user UP is
"Auteur Match / Same director/writer" (`OrbitControls.tsx:100-138`); the drag hint says
"Auteur" (`OrbitCardStack.tsx:156-194`). RIGHT is `balanced` in the engine and "Go back" in
the drag hints. A user cannot form a mental model of a space whose axes are described
differently each time they are mentioned. This is the clearest example of the internal
confusion you asked me to surface.

Also: a debug counter ships to production — a fixed pill reading
"N more to unlock pattern insights" (`DiscoverScreen.tsx:317-320`).

### 3.7 Structural duplication — severity: medium

> **Recommendation superseded, findings unchanged.** Nothing gets deleted. Each surface below
> keeps its route and is promoted into one system — the mapping is in
> [DECISIONS.md §24](DECISIONS.md#24-nothing-gets-deleted--plan-inverted).

- `HomeV2.tsx` (1,153 lines) is a complete second home screen, ~70% duplicated from
  `MovieCalendarApp.tsx`, not imported by any route. It is also the *better* composition —
  recommendation-first with the calendar demoted to a bottom date strip. Someone had the
  right idea and it is sitting unreferenced.
- `useExplorationSession.ts` (242 lines) duplicates `ExplorationContext` with a *different*
  system voice, unused.
- Handle-claiming exists in three places: silent claim in onboarding, the global blue
  banner, and the avatar modal.
- `\u2022` is rendered as a literal string instead of `•` in `HomeV2.tsx:969,988`.
- Dead: `MOCK_DB` of 8 films (`MovieCalendarApp.tsx:466-475`), `orbitStore.goBack()`,
  `OrbitCard.onSaveToggle`, `isLoadingVibe`, a `// Deploy trigger Mon Dec 8` comment
  (`OrbitScreen.tsx:522`).
- Five separate list screens (`/watched`, `/watchlist`, `/vibes`, `/liked`, `/lists`) that
  are the same interaction with different filters.
- **Five overlapping "taste" features**: Orbit, DNA (`/dna/:id`), Profile "Taste DNA",
  Saved Vibes, and Pattern Assistant. "DNA" already means two different things in the
  product — a cast/crew traversal screen *and* three sentences on the profile.

### 3.8 Accessibility and touch — severity: medium

- Icon-only controls below the 44pt minimum: refresh (`p-2`), banner dismiss (`p-1`,
  `ClaimHandleBanner.tsx:107`), search clear, DNA/back chips.
- `RecommendationCard` action row is `py-2.5` ≈ 40px, with four targets side by side.
- The onboarding film grid is 3-up with `gap-1.5` (`FilmPickerScroll.tsx:117`) — ~110px
  cells with a search bar pinned over the CTA safe area.
- `user-scalable=no, maximum-scale=1.0` (`index.html`) blocks pinch-zoom app-wide.
- Body copy at `text-gray-500` on `#09090b` is roughly 4.1:1 — under AA for small text.
- `/waitlist` is a dead end: it says "Reach out to the team" with no link, address, or form
  (`WaitlistScreen.tsx:43-44`). Every rejected user is lost with no capture.

---

## 4. Your features, assessed one at a time

### 4.1 The opening screen — full-screen trailer

> **Superseded.** You want the calendar to stay on the first screen, enhanced with a video
> carousel, the film's logo in front, and a detented date strip below — which is `HomeV2.tsx`,
> your own unrouted prototype. I withdraw the demotion. Everything below about *sequencing*
> (verdict before atmosphere, never a black hero) still holds and now applies to the carousel.

**Verdict: right instinct, and it needs one guardrail.**

Killing calendar-as-home is correct and overdue. But "full-screen trailer" and "find films
as fast as they can" pull opposite ways — a trailer is a 30-second commitment and you are
selling a 90-second session.

The resolution is sequencing: **the verdict must be readable before the video arrives.**
One film, full-bleed. The backdrop is the first frame — never a black hole while YouTube
boots, which is the current failure mode on the movie page. One line that argues for the
film. One row of facet tags. One gesture down for the next film, one gesture up to commit.
The video is atmosphere layered on top of a screen that already worked without it.

Craft notes from the existing implementation: the movie page hero already autoplays muted
and loops (`MovieDetailScreen.tsx:312-333`) and prefers Clip > Featurette > Trailer >
Teaser (`useMovieDetails.ts:144-157`) — good instincts. But TMDB trailer quality is wildly
inconsistent (dubbed uploads, 4:3 letterboxes, "official teaser" slates), so a hero that
depends on it will feel broken maybe a fifth of the time. Prefer a short loop, cap it at
~8 seconds, and make the poster/backdrop path visually complete on its own with grain and
a slow drift.

### 4.2 The monthly AI-cut video — "Spotify Wrapped for film"

> **Partly superseded.** Your Amazon-Prime-slate framing won the format argument: for someone
> logging 20–25 films a month, a cut of clips and dialogue is genuinely personal and a still
> can't carry it. Resolution is a ladder — the Print monthly for everyone, **the Cut** earned
> by logging, the Year in December. Making it earned controls render cost *and* turns logging
> into what unlocks the artifact. The scarcity argument below still explains why it must be
> earned rather than automatic.

**Verdict: right instinct, wrong cadence and wrong medium. This is where I'd push back hardest.**

Wrapped works on three properties: annual scarcity, it is about *identity* not data, and it
is engineered to be screenshotted. Monthly video breaks two of the three. Scarcity dies at
12× a year, and a cinephile logging 8–20 films a month does not have enough data for a
narrative arc. You would also be shipping the most expensive artifact in the product on the
schedule where it is least earned.

**Do this instead: monthly is a poster, annual is the film.**

At the end of every month the app hands the user a **one-sheet for their month** — a still,
poster-shaped, typeset-in-your-brand image: the films, the dominant colour pulled from their
posters, their top facets, one line of verdict about who they were in November. Still images
are cheap, instant, offline-able, and get posted. And a *movie poster of your month* is
precisely the Brooklyn-flyer aesthetic you described, which means every share is a brand
impression rather than a screenshot of a UI.

Then the annual cut is the event, and it is worth an actual video because a year of data
supports one.

This is also the most direct answer to your brand brief — "bleeds through phone, real life,
film, cinema, and the landing page." A one-sheet is printable. Stickerable. It is the same
artifact on a phone, on a wall, and as the hero of the landing page. Nothing else in your
feature list crosses those surfaces natively.

### 4.3 Onboarding with morphing transitions

**Verdict: right, and the sequencing is currently backwards.**

Today: 7 hard-cut pages, and pages 5–6 ask for a Letterboxd username and an IMDb CSV before
the user has seen a single recommendation. That is investment before reward, the #1 listed
mistake in the Hook framework and the most reliable way to kill a funnel.

Restructure so reward precedes investment:

1. **Pick three films you'd rewatch tonight.** Posters, full-bleed, no chrome. This *is* the
   product's core action, performed before signup — a Duolingo "play first, account later"
   move.
2. **Immediate reward.** The three posters morph into one sentence that is uncomfortably
   accurate about them, plus the facets it read. This is the moment they decide.
3. **One recommendation**, full-screen, with the reason. Value delivered.
4. **Then** ask for Letterboxd — reframed as *"we can read 800 films in 4 seconds"*, with a
   reveal on the other side.

On the morph specifically: the mechanism is `layoutId` on the poster in Framer Motion, which
is already a dependency. The selected poster travels from grid cell to hero to graph node.
That single continuity trick will do more for the "smoothness" complaint than any easing
curve, because the perceived jank is not bad easing — it is that elements teleport.

### 4.4 The movie page

**Verdict: closest to your vision already; the wins are mostly deletions and un-hidings.**

Working: 60vh muted looping hero, mute toggle, tap-to-fullscreen, rating badges,
`TechBadges` for IMAX/Dolby.

Against your brief:

| You want | Reality |
|---|---|
| Punchy one-liner that sells it | Exists — `knownFor`, 7 words (`api/movie-known-for.ts:8`) — buried below three button rows at `MovieDetailScreen.tsx:479-483` |
| Hyper-specific tags, not genres | Zero tags rendered. Reddit micro-tags fetched and discarded |
| Personalized synopsis | TMDB studio boilerplate. The Letterboxd-voice `vibeDescription` is generated and never rendered (`useMovieDetails.ts:252-274`) |
| Technical specs — what ratio was it shot in | Only IMAX/Dolby booleans, at `opacity-50` (`TechBadges.tsx:14`). No aspect ratio, no format, no lenses, no negative |
| "Five similar in terms of what?" | 3-col poster grid, reason computed and thrown away |
| Doesn't look like AI | A `Sparkles` icon and a button labelled "Ask AI" |

Fastest sequence of wins on this one screen: render the reason under each similar film;
promote the one-liner above the buttons; render the Reddit facet tags; swap the TMDB synopsis
for `vibeDescription`; rename "Ask AI" to the first suggested question; build out tech specs
into a real mono-set spec block; delete `Sparkles`.

Also: the hero must never be a black rectangle. Paint the backdrop, then let video arrive
over it.

### 4.5 Taste profile as a knowledge graph

**Verdict: this is the actual product. Nothing shipped today resembles it.**

You want: dots travelling node to node, colour and vibe driven, edge strength as a real
score, and *"Heat and The Dark Knight are related but visible in a non-geek natural way —
the blues, the crime, the heist."*

What exists:

- `/profile` — stat cards and three AI sentences (`ProfileScreen.tsx:208-232`). Not a graph.
- `/dna/:id` — a breadcrumb plus a grid of cast/crew headshots. Traversal is
  `movie → person → movie` through TMDB credits (`dnaEngine.ts:15-115`). No positions, no
  edges, no weights, no animation between nodes. "Highest popularity, slice(0,12)."
- Orbit's constellation — the closest thing, and it is a 2D trail on **fixed offsets** by
  swipe direction (`ConstellationView.tsx:25-34`: visual = dy −140, balanced = dx +120…).
  Layout encodes *which button you pressed*, not similarity. `similarityScore` is stored on
  every edge (`orbitStore.ts:26`) and never displayed.

Three things this needs, in order:

1. **A facet vocabulary** (see `DIRECTION.md`). Without it there is nothing to compute
   edges from and nothing to label them with.
2. **Edges labelled in human language, not numbers.** Your own example is the spec: the
   Heat ↔ Dark Knight edge should read `city as antagonist · procedural heist · cop and
   criminal mirror each other · sodium-and-cyan night`. Strength can drive line weight and
   opacity; it should never be shown as `0.87`. That is the difference between "geek" and
   "natural."
3. **Colour from posters, not a palette.** You already extract dominant colour. A graph
   where each node carries its film's own colour is legible at a glance and is impossible to
   confuse with a generic data-viz.

On "logistic regression": you don't need a trained model to start, and pretending to have
one will hurt you. Edge weight = weighted overlap of shared facets, with rarer facets
weighted higher (TF-IDF over your facet vocabulary). Two films sharing *heist procedural*
should score far above two sharing *drama*. That is explainable, debuggable, instant, and
produces exactly the "subsets of subsets" texture. Learn weights from user behaviour later,
once there is behaviour to learn from — which requires fixing the Investment row first.

### 4.6 The exploration progression

**Verdict: half-built and thrown away every session.**

You described searching a crime film, moving to another film, and having the app compound on
that. `ExplorationContext` does exactly this — accumulates clicked films, fires a pattern
read at 3+ (`:183`), offers "show me more" — and then loses all of it on reload (`:132`,
`useState`). It also never influences the movie page, the recommendation, or Orbit. It is a
session toy, not a spine.

Two corrections beyond persistence. First, do not literally implement AP/GP — a geometric
schedule means the Nth film is chosen by a formula rather than by taste, and users feel
that immediately. What you actually want is **recency-weighted drift**: each film shifts the
active facet vector, recent picks weigh more, and the app widens or narrows the radius
depending on whether the user is converging (repeated facets) or wandering (scattered
facets). Second, **show the drift.** The reason this feels magic in Spotify is that the
state is visible. A thin persistent line of type — *"you're three films into sodium-lit
crime; want to leave the city?"* — makes the machine legible without a chat bubble.

### 4.7 Orbit

**Verdict: mechanically the best thing in the app; conceptually incoherent.**

Real springs, real haptics, prefetching, a shatter transition, a constellation. And its four
axes are described three contradictory ways (§3.6), its layout encodes button presses rather
than similarity, back navigation leaves stale hints, and it is reachable only from a gradient
button on a movie page.

Orbit and DNA are the same feature. **Orbit is the motion; DNA is the map.** One graph, one
vocabulary, two views of it — swipe to travel, pinch to see where you are. That collapses
five taste features into one and gives you the rabbit hole you're describing.

### 4.8 Letterboxd import as conversion

**Verdict: the highest-leverage moment in the product, currently a toast.**

Today: a text field, then a spinner, then the word "Imported", then `setTimeout(1500)` and
the next page (`OnboardingScreen.tsx:110`). Nothing about the app changes visibly afterwards.

A cinephile handing you 800 rated films has just given you everything, and the app must
immediately hand back something Letterboxd never could. Not a count — a **reading**. Their
graph, drawn. Their five defining facets. The specific, slightly invasive observation
(*"you have watched 41 films shot by six cinematographers"*, *"you rate every film about
brothers above four stars"*). And their blind spot, which is the one thing that makes the
next session inevitable.

That is the "completely convert to a Selects user" moment. It is a single screen and it is
worth more than any other screen in the roadmap.

### 4.9 Logo

Covered in §3.1 and designed in `DIRECTION.md`. The short version: it must survive at 60px
on a crowded home screen, must not be a film strip, and should ideally be a shape the
product can *reuse as a UI primitive* — the way Oura's ring is both the mark and the
progress indicator. A mark that only lives on the splash screen is a wasted asset.

### 4.10 Theatres and formats

Not designed here, per your instruction. One note to bank: the mono-set technical spec block
proposed in §4.4 is the natural hook for it later — *shot on 65mm, so see it in 70mm* is a
sentence the format data already almost supports.

---

## 5. Reading your vision back to you

The strategy is sharper than the execution. Six tensions worth resolving explicitly,
because each one is currently being resolved *by accident* in the code.

**1. "Full of AI, doesn't look like AI" vs "the app should talk to me" and "dynamic text
everywhere just running."** Running text is the most obvious AI tell of the current era —
typewriter effects read as *chatbot*, immediately. The tell was never motion; it is
vagueness. AI should surface as **specificity**, and it should arrive already-written.
Practical rules: no `Sparkles`, no purple, never the words *AI*, *generate*, or *powered by*
in the UI, and no button that announces a robot — replace "Ask AI" with the question itself.
Oura works this way: it says *"your HRV dropped, you may be fighting something off"*, not
*"AI insight available."*

**2. "Maximalism" and "very subtle" simultaneously.** These reconcile under one rule:
**maximal information density, minimal decoration density.** A tech-house poster is
maximalist in type, grid, and data, and it is monochrome plus one ink with no gradients, no
glows, no blur, no drop shadows. Which is the precise inverse of the app today — currently
thin on information and heavy on decoration.

**3. Speed vs spectacle.** Resolved by sequencing, not compromise: verdict first, atmosphere
second. See §4.1.

**4. Sticky vs fast.** The reframe in §0: two 90-second sessions a day, not one twenty-minute
one. Stickiness lives in return frequency and identity, not dwell time. If you accept this,
"time in app" should never become a metric you look at.

**5. Feature sprawl.** You have five features doing the taste job (Orbit, DNA, Taste DNA,
Saved Vibes, Pattern Assistant), five list screens, two home screens, three handle-claim
surfaces, and two brand names. The confusion you sensed on the team is real and it is legible
in the codebase: the same concept keeps getting rebuilt under a new name instead of the
previous one getting finished. My strongest process recommendation is a naming freeze — one
noun per concept, written down, before the next feature.

**6. The unasked question: what is the daily reason?** Everything you described is a
*second*-session feature — rabbit holes, DNA, wrapped, orbit. None of it is a reason to open
the app on an ordinary Tuesday when the user isn't looking for anything. Oura has one: a
number waiting for you every morning, before you ask. You need the equivalent — one thing
that is *already different* when the app opens, unprompted, every day. That is the missing
piece of the loop, and it is question one in `QUESTIONS.md`.

---

## 6. What I would do first

> **Superseded.** Rewritten against your answers — the current sequence is
> [DECISIONS.md § What this changes in the roadmap](DECISIONS.md#what-this-changes-in-the-roadmap).
> Two things changed: nothing is deleted (surfaces get promoted into one system instead), and
> Focus + the Ticket lead, because a decaying readiness score is what finally makes investment
> load the next trigger. The stage-1 and stage-2 items below are unchanged and still correct.

Not a schedule — a dependency order. Each stage unlocks the next.

**Stage 1 — make the loop close.** Nothing else matters until it does.

1. Persist the exploration graph to Firestore (`ExplorationContext:132`).
2. Make the core action's reward worth the tap: poster morphs into the day cell, haptic,
   and a visible count of what the user is building.
3. Build one trigger channel. Without push, email, or a widget, there is no loop.
4. Ship the facet vocabulary and pipe it into every prompt in place of `GENRE_MAP`.

**Stage 2 — un-hide what is already built.** Very high ratio of payoff to effort.

5. Render similarity reasons under similar films.
6. Render the Reddit micro-tags as facet chips.
7. Swap the TMDB synopsis for `vibeDescription`; wire `taste` into the chat.
8. Promote the one-liner above the CTAs; remove `Sparkles`; rename "Ask AI".
9. Fix the Orbit axis labels to one vocabulary. Purge purple.

**Stage 3 — the front door.** Now there is something worth opening it for.

10. Wire `HomeV2.tsx` and add the video carousel and the detented date strip. The calendar
    stays home; it gets enhanced rather than demoted.
11. Onboarding restructured reward-before-investment, with `layoutId` morphs.
12. The Letterboxd import reveal.

**Stage 4 — identity.** Once behaviour is worth reading.

13. The mark, the typeface, the token set. Retire `ViewFindr`.
14. The Print and the Cut, and the landing page built from the same artifact.
15. One unified graph — Rabbit Hole as motion, the Assembly as map — with `DNAScreen`, the
    constellation and Saved Vibes promoted into it rather than removed.

**Deliberately not now:** Selects Maps and film tourism, perks partnerships, TV, and a
trained similarity model (which needs data the Investment fix will produce).

---

## Appendix — defect register

| # | Sev | Finding | Location |
|---|---|---|---|
| 1 | Critical | Exploration graph destroyed on reload | `ExplorationContext.tsx:132` |
| 2 | Critical | No external trigger channel of any kind | repo-wide |
| 3 | Critical | Core action reward is a 44px near-black square | `MovieCalendarApp.tsx:1300` |
| 4 | Critical | All taste reasoning runs on 19 TMDB genre strings | `useMovieSearch.ts:11-31` |
| 5 | Critical | App icon invisible on home screen | `public/pwa-512x512.png` |
| 6 | Critical | Similarity reasons computed, discarded | `MovieDetailScreen.tsx:589` |
| 7 | High | Reddit micro-tags fetched, never rendered | `api/reddit-context.ts:27` |
| 8 | High | `vibeDescription` generated, never rendered | `useMovieDetails.ts:252-274` |
| 9 | High | Chat `taste` hardcoded `undefined` | `MovieDetailScreen.tsx:757` |
| 10 | High | Orbit axes labelled three contradictory ways | `orbitStore.ts:4`, `OrbitControls.tsx:100`, `OrbitCardStack.tsx:156` |
| 11 | High | Investment requested before any reward in onboarding | `OnboardingScreen.tsx:313-426` |
| 12 | High | Onboarding bypassed by Google + returning sign-in | `LoginScreen.tsx:67,115` |
| 13 | High | Wordmark PNG has opaque black plate | `public/selects-logo.png` |
| 14 | High | Three product names shipping at once | `manifest.json:2`, `vite.config.ts:26`, `package.json:2` |
| 15 | High | Movie page blocks all paint on full fetch chain | `MovieDetailScreen.tsx:286` |
| 16 | High | No webfont loaded; no typographic voice | `index.html`, `index.css:22` |
| 17 | High | Six accent colour families, no tokens | repo-wide |
| 18 | High | No shared-element transitions anywhere | repo-wide |
| 19 | High | Onboarding and login steps are hard cuts | `OnboardingScreen.tsx:190-426` |
| 20 | Medium | `HomeV2.tsx` — 1,153 lines of unrouted better home | `src/prototype/HomeV2.tsx` |
| 21 | Medium | Empty-day tap ejects user off `/app` | `MovieCalendarApp.tsx:800` |
| 22 | Medium | Six choices on one 96px recommendation card | `RecommendationCard.tsx:176-224` |
| 23 | Medium | Three search entry points, different behaviours | `MovieCalendarApp.tsx:1118,1948,800` |
| 24 | Medium | Debug counter pill in production | `DiscoverScreen.tsx:317` |
| 25 | Medium | Waitlist is a dead end with no capture | `WaitlistScreen.tsx:43` |
| 26 | Medium | Haptics only fire in Orbit | `src/lib/haptics.ts` |
| 27 | Medium | Orbit `goBack` leaves stale prefetch | `orbitStore.ts:180-194` |
| 28 | Medium | Tap targets below 44pt throughout | `ClaimHandleBanner.tsx:107` et al |
| 29 | Medium | Pinch-zoom disabled app-wide | `index.html` |
| 30 | Medium | `text-gray-500` body copy under AA contrast | repo-wide |
| 31 | Medium | Third-party logos at 2048px for 16px badges | `public/imdb-logo.png` |
| 32 | Medium | Two PWA manifests; stale ViewFindr one ships | `public/manifest.json` |
| 33 | Low | `useExplorationSession.ts` unused duplicate | 242 lines |
| 34 | Low | `\u2022` rendered literally | `HomeV2.tsx:969,988` |
| 35 | Low | Five list screens, one interaction | `/watched`, `/watchlist`, `/vibes`, `/liked`, `/lists` |
| 36 | Low | Two taglines in circulation | `SplashScreen.tsx:29`, `MovieCalendarApp.tsx:1115` |
| 37 | Low | Dead `MOCK_DB`, deploy-trigger comment, unused exports | `MovieCalendarApp.tsx:466`, `OrbitScreen.tsx:522` |
| 38 | Low | Analytics measures features, not the loop | `src/lib/analytics.ts` |
