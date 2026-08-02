# The Vocabulary

Answer to round-2 Q6. You said: don't hand-write it — mine it. Read Reddit and Letterboxd
reviews across genres, build a word cloud, polish it, look at how professional critics write,
and land in the middle. Then look at what Letterboxd is doing with themes and nanogenres and
be more dynamic and personal than that.

I did the Letterboxd research. It changed my recommendation in one important way, so that
comes first.

---

## 1. What Letterboxd actually ships

Letterboxd's Similar Films, Themes and Nanogenres are powered by **Nanocrowd**, via their
*ViewerVoice* / *Reaction Mapping* platform. Facts worth having:

- It covers **~20,000 titles** — Letterboxd's most popular. Not the long tail. There is even a
  "Hide Nanocrowd films" visibility filter, which tells you coverage gaps are visible enough
  to need one.
- A nanogenre is **exactly three comma-separated words**, clustered from emotive language in
  audience reviews.
- The hierarchy is **genre → theme → nanogenre**.
- Personalisation is **filtering only**: hide watched, filter by decade, filter by streaming
  service, and (for Patrons) stats on your most-watched nanogenres. The nanogenres themselves
  are global and identical for every user.

Real examples, verbatim:

| Film | Nanogenres |
|---|---|
| *Zero Dark Thirty* | Terrorism, Government, Cia · Disturbing, Gripping, Riveting · Blood, Brutal, Extreme · America, Government, Freedom |
| *Fast & Furious* | Driving, Chases, Action-Packed · Cars, Crashes, Adrenaline · Explosives, Mindless, Excitement · Jokes, Guns, Cool |
| *(500) Days of Summer* | Romance, Dating, Boyfriend · Witty, Cute, Intelligent · Feelings, Cute, Formulaic · Jokes, Delightful, Cute |
| *Looper* | Suspense, Slick, Stylish · Twist, Mysterious, Confusing |

## 2. Where it's weak

Five things, and the fourth is the one that matters.

1. **They're bags of words, not statements.** "Terrorism, Government, Cia" tells you what the
   film is *about*. It doesn't tell you what it's *like* to sit through, or why you in
   particular would want to. It's a keyword cluster wearing a name.
2. **The adjectives are low-information and they repeat.** Four of *Fast & Furious*'s ten
   nanogenres contain "Action-Packed" or "Excitement". Four of *(500) Days*'s contain "Cute"
   or "Witty". Terms that appear everywhere can't partition anything.
3. **It reads like output.** "Cia" not "CIA". "Chick-Flick". Nobody says these out loud.
4. **Craft is completely absent.** Go back through every example above: there is not one term
   about how a film was photographed, how the camera behaves, how time is structured, or what
   format it was shot on. Not one. And that is not an oversight — it is **structural**.
   Nanocrowd mines audience reviews, and audience reviews overwhelmingly discuss plot and
   feeling. You cannot recover "anamorphic", "locked-off", "elliptical" or "shot on 65mm" from
   a corpus that never says them.
5. **It's static and global.** Same three words for everybody, forever. Your personalisation
   is a checkbox that hides films you've seen.

**Point 4 is the whole opening.** Your user zero — the one who cares what format a film was
shot in — is invisible to a review-mining system. And your instinct to blend vernacular with
critics turns out not to be a stylistic preference at all: **the vernacular half is the only
place you can get feeling, and the critic half is the only place you can get craft.** You need
both because they carry different information, not because the mix sounds nicer.

That's the differentiator, and it's defensible: *Nanocrowd can't build our craft axes from
their sources, and we can't build their emotional coverage from ours alone.*

## 3. The register ladder

Four ways of describing the same quality in *Heat*:

| Register | How it sounds | Problem |
|---|---|---|
| **Reddit / Letterboxd** | "this movie has no business going that hard" | fun, zero information, doesn't partition |
| **Nanocrowd** | `Suspense, Guns, Action-Packed` | machine-readable, says nothing |
| **Critic / trade** | "Spinotti's available-light nocturnes and Mann's elliptical cross-cutting" | precise, and it makes a regular reader feel stupid |
| **Selects** | **sodium-lit and shot wide · nobody wins · both men are good at their jobs** | precise about craft, casual in register |

**The rule: precise about craft, casual in register.** A facet has to be something a person
could say out loud at a bar and be understood — while still carrying real information about
how the film was made.

That is also, exactly, your answer to round-1 Q19: *"a regular user uses the app and feels
smart."* Not *is told they're smart* — **feels** smart, because they now have words for
something they'd only ever felt.

## 4. The eight axes, and where each one's words come from

| Axis | Example terms | Minable from reviews? | Real source |
|---|---|---|---|
| `look` | sodium-and-cyan night · 35mm grain · available light · video-tape texture | partially | critics + DP interviews + poster/still colour sampling |
| `camera` | locked-off · handheld verité · dolly-in on faces · unbroken take | **no** | critics, ASC/trade press |
| `tempo` | slow burn · procedural · breathless · dread accumulating | **yes** | audience reviews — this is what they talk about |
| `weather` | nobody wins · competence porn · guilt as engine · complicity | **yes** | audience reviews, the strongest signal there |
| `sound` | needle-drop maximalism · silence as threat · synth pulse | partially | audience for needle-drops, critics for the rest |
| `world` | rain-slick city night · institutional corridors · one apartment | **yes** | audience reviews |
| `shape` | nonlinear · frame story · two-hander · ensemble braid | partially | critics |
| `format` | 1.37 Academy · 2.39 anamorphic · IMAX 70mm · 16mm blowup | **no** | **structured metadata — free** |

Two things fall out of that table.

**Half the axes need the critic corpus.** `camera` and `shape` are essentially unrecoverable
from audience language. This is the concrete reason the middle ground is required.

**`format` needs no mining at all.** It's structured data, and *the app already scrapes it* —
`api/imdb-techspecs.ts` hits IMDb's technical specifications page today and throws away
everything except two booleans for IMAX and Dolby. Aspect ratio, negative format, printed
format, camera and lens data are all on that page. That's an entire axis, exact rather than
inferred, for the cost of parsing more of a response you already fetch.

## 5. The pipeline

**Sources.** Three corpora, deliberately unequal:

| Corpus | For | Notes |
|---|---|---|
| Letterboxd + Reddit reviews (`r/TrueFilm`, `r/movies`, `r/criterion`, `r/flicks`, genre subs) | feeling, tempo, world, moral weather | `r/TrueFilm` is the bridge — hobbyists using craft language casually. Weight it highest. |
| Critic long-form and trade press | camera, shape, look | small corpus, high density |
| IMDb technical specs + TMDB metadata | format, and colour from posters | structured, exact, already fetched |

**Steps.**

1. **Spine.** ~2,000 films chosen to span eras, movements, budgets and countries — not the
   top 2,000 by popularity, or the vocabulary comes out shaped like a multiplex.
2. **Harvest.** N reviews per film per corpus.
3. **Candidate extraction.** 2–5 word noun and adjective phrases.
4. **Score.** TF-IDF against a *film-writing* baseline rather than general English, so "great
   movie" and "the cinematography was beautiful" die and "sodium-lit" survives. Then a second
   **partition score**: a phrase attached to 40% of films is worthless no matter how filmic it
   sounds. This is the step that would have killed "Action-Packed".
5. **Cluster** candidates into the eight axes by embedding, then merge near-duplicates.
6. **Polish** — pick the canonical phrasing per cluster.

**Step 6 is the only part that needs you, and it is not writing.** You get maybe 600 ranked
candidate clusters, each with its top phrasings and twenty example films. You pick one
phrasing per cluster, kill the ones that are wrong, and occasionally type a better line. Your
round-1 answer to Q6 was that you'd write a hundred rows but doubted anyone else would — this
reframes the job as **approve, don't author**, which is a couple of hours and much closer to
your "least friction" principle.

Then Layer 1 tags every film against the frozen vocabulary, cached forever.

## 6. How it stays dynamic

Your specific complaint about Nanocrowd. Four mechanisms:

1. **The vocabulary re-mines on a schedule.** New terms enter when they clear the partition
   threshold and stale ones age out. Film vernacular moves fast; a frozen list is dated within
   two years, which is roughly where Nanocrowd's adjectives already are.
2. **Corrections feed term quality.** Long-press *wrong / not why I liked it* is a vote against
   a specific tag on a specific film. Enough of them and the term is either re-scoped or
   retired. Nanocrowd has no equivalent — there is nowhere to tell Letterboxd that
   "Formulaic" is a bad read of *(500) Days of Summer*.
3. **Rooms are generated, not listed.** A room's name and membership are composed per user at
   request time. Two people who reach the same facet get differently-named rooms with
   differently-ordered films.
4. **Edges are recomputed as the user's graph grows.** Which facets matter is a function of
   what's rare *in their corpus*, not globally.

## 7. How it stays personal

Layer 2 (`DIRECTION.md §7`), plus your round-2 Q8 answer: users **do** know their names are
their own.

So the personalisation is disclosed rather than hidden. On a facet, a small affordance —
*your name for this*. And when two people compare graphs, both namings show:

> **You call it** sodium-lit and shot wide
> **They call it** that Michael Mann blue

That turns the one moment where personalisation could feel like a glitch into the moment it's
most obviously a feature. It also makes the match-percentage screen substantially more
interesting than a number.

## 8. The one-line difference

> **Nanocrowd tags the film. Selects tags the edge.**

Their unit is a bag of three words attached to a title. Ours is *the reason two films are
connected*, written as a sentence — which is precisely what you asked for in round 1 when you
said "similar in terms of what?"

A nanogenre tells you *Heat* is `Suspense, Guns, Action-Packed`. It cannot tell you that
*Heat* and *The Dark Knight* are joined because the city is the antagonist and both men are
good at their jobs. That sentence is the product.

## 9. Practical notes

- **Terms of use.** Scraping Letterboxd and Reddit reviews at corpus scale needs checking.
  Reddit has an API with defined terms; Letterboxd's public review pages do not obviously
  permit bulk harvesting. Mining a smaller, licensed or public-domain critic corpus plus
  Reddit may be the safer build, and it costs little because the critic corpus is where the
  scarce craft language lives anyway.
- **The spine is a one-time cost**; per-film tagging afterwards is a single cached call.
- **`format` should ship first.** It needs no mining, the endpoint already exists, and it is
  the axis your user zero will notice immediately.
