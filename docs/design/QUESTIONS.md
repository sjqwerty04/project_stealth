# Questions

You asked me to ask. These are ordered by how much they change the design, not by how easy
they are to answer. The seven marked **BLOCKING** are ones where I would build the wrong
thing if I guessed.

---

## A. The loop

**1. BLOCKING — What is the reason to open Selects on a Tuesday when the user isn't looking
for anything?**
Every feature you described — rabbit holes, DNA, wrapped, orbit — is a *second*-session
feature. Oura has one answer to this: a number waiting for you every morning, before you ask.
`DIRECTION.md §1` proposes "Tonight" — one film already chosen, changed since yesterday, with
a reason about *you*. Is that the answer, or is yours something else? Everything downstream
depends on this.

**2. BLOCKING — Are you willing to ship push notifications?**
There is currently no external trigger channel of any kind in the codebase. Without one, the
loop cannot close — the user has to remember you exist. If push is off the table for taste
reasons, the alternatives are a home-screen widget or email, and both change the roadmap
significantly. I need to know which before designing the return path.

**3. Two 90-second sessions a day, or one 20-minute session a week?**
You said both "find films as fast as they can" and "keep users where they are." I have been
designing against the first. If you actually want dwell time, the rabbit hole becomes the
product and the recommendation becomes the entrance — a materially different app.

**4. What does the user do the moment they finish a film at 11:40pm?**
This is the strongest untapped internal trigger in your category — the itch to place a film
and be understood about it. Right now the app has no answer. Do you want to own that moment?

---

## B. Taste and taxonomy

**5. BLOCKING — Who writes the facets?**
`DIRECTION.md §7` proposes eight axes of specific, human-readable tags. Three ways to fill
them: (a) an LLM tags on demand per film and you cache, (b) you hand-curate a seed corpus of
~500 canonical films and let the model extend from those examples, (c) fully generative every
time. Option (b) produces by far the best voice, because the model imitates *your* taste in
language — but it needs you to write a few hundred rows yourself. Are you willing to?

**6. Is the vocabulary fixed or open?**
A closed list is legible, computable, and repeats. An open list is infinitely specific and
occasionally embarrassing. My instinct: closed for the six axes that drive the graph, open
for the one-liner. Do you agree, or do you want the tags themselves to surprise you?

**7. Would you show a user a facet they'd be annoyed by?**
"You keep choosing men who lose." "You rate every film about brothers above four stars."
The invasive read is the thing people screenshot — and it is also the thing that makes a
minority of users close the app. How sharp is too sharp?

**8. Does the graph include films the user hasn't seen?**
A pure map of your own taste is finite and eventually boring. A map that extends into the
dark is infinite but stops being *yours*. Where's the line — and should unseen films look
visibly different from seen ones?

**9. Two people whose taste is 80% identical — what should feel different when they each open
their graph?**
This is the test for whether the graph is genuinely personal or just a re-skinned corpus.

---

## C. The calendar and logging

**10. BLOCKING — Is logging load-bearing, or is it a byproduct?**
You want the calendar off the first screen, which I agree with. But logging is the only thing
the user invests, and investment is the row of the Hook model currently scoring zero. Two
options: logging stays essential but moves (home becomes the recommendation, the calendar
becomes the artifact you visit), or logging becomes fully passive from imports and the
calendar is output-only. The second is cleaner and much less sticky.

**11. Does a rating matter, or only that they watched it?**
Letterboxd has the star rating locked up culturally. You could differentiate by *not* asking
for a number — logging only what they saw and reading the taste from the pattern. Riskier,
much lower friction, and more in keeping with "the app understands you without being told."

**12. What happens on the 400th logged film?**
Everything designed for an empty state has to survive a decade of data. Does the calendar
stay a calendar at that scale, or does it become something else entirely?

---

## D. Import and conversion

**13. BLOCKING — What does the user get in the first three seconds after importing 800
Letterboxd films?**
Right now: the word "Imported" and a 1.5-second timeout. `AUDIT.md §4.8` argues this is the
single highest-leverage screen in the product. What is the one thing on it? My proposal is a
reading, not a count — their five defining facets, one invasive observation, and their blind
spot. Is the blind spot the hook, or is it insulting?

**14. Do you want their ratings, or only their titles?**
Ratings make the model far better and make the import feel like surveillance. Titles alone
are safer and weaker.

**15. If someone has no Letterboxd, are they a second-class user forever?**
Onboarding currently asks for three favourites, which is a thin cold start. Is there a fast
path to a good graph without an import — and what does it cost them?

---

## E. Aesthetics

**16. BLOCKING — Warm ink or cool black?**
`DIRECTION.md §4` moves the base from `#09090b` (Tailwind's default zinc, which reads
"template") to `#0B0A08` warm. It is a small number and a large decision: warm reads
photochemical and repertory, cool reads streaming and tech. Everything else follows from it.

**17. Is the grease-pencil ring right?**
It maps to the name, the orbit, and a graph node simultaneously, and it survives at 60px —
which the current icon does not. But rings are a crowded category and it will need a
trademark check. If it's wrong, tell me what it's wrong about: too soft, too analog, too
obvious?

**18. Are you willing to license a typeface?**
No webfont is loaded today, which is why the app has no voice. Diatype or Söhne would give
you the exact Brooklyn-flyer register you described; Inter and JetBrains Mono get you 80% of
the way for free but will always read slightly generic to a designer's eye. Which trade?

**19. Which reference is closest — a Criterion sleeve, a rep-house calendar, a techno flyer,
or a lab report?**
You named the techno flyer. The mono-heavy spec-sheet direction in `DIRECTION.md §5` leans
toward the lab report. They're compatible, but the balance changes how cold the app feels.

**20. How much does the app talk?**
"Dynamic text everywhere just running" and "doesn't look like AI" are in tension — running
text is the strongest chatbot signal there is. My proposal is that text arrives already
written and is *specific* rather than animated, with exactly one exception: the edge label
that types as a dot travels an edge. Is one exception enough, or do you want more motion in
the language?

---

## F. Sharing and the outside world

**21. Monthly poster and annual film, or monthly film?**
`AUDIT.md §4.2` is my strongest disagreement with your brief. Wrapped works on annual
scarcity, and a monthly video costs the most on the schedule where it is least earned. A
monthly *one-sheet* is cheap, instant, printable, and the same artifact on a phone, a wall,
and the landing page. Push back on me here if you feel strongly.

**22. Should a user's graph be public?**
A shareable taste map is the strongest organic acquisition asset you have — and it turns a
private, slightly embarrassing thing into a performance. That changes what people log.

**23. Is the social layer people you know, or people who share your taste?**
Shared watchlists exist in the code today with no notifications, so the tribe reward is
currently zero. Which direction it goes decides whether this is a group-chat product or a
discovery product.

---

## G. Scope and process

**24. May I delete things?**
There are five features doing the taste job (Orbit, `/dna/:id`, Profile Taste DNA, Saved
Vibes, Pattern Assistant), five list screens, two home screens, and three handle-claim
surfaces. My recommendation collapses these hard. I'd rather have your permission than
surprise you.

**25. `HomeV2.tsx` — dead, or the plan?**
1,153 unrouted lines, ~70% duplicated from the live home, and it is the *better* composition:
recommendation first, calendar demoted to a bottom strip. Was it abandoned for a reason, or
just never wired up?

**26. Who is user zero?**
"Cinephiles who love logging and geek out on movies" is a scene, not a person. Name one real
human. Every call in `DIRECTION.md` gets easier — especially §7, where the difference between
"sodium-lit" and "atmospheric" is entirely a question of who is reading it.

**27. What do you want to be true 30 days after someone installs this?**
One sentence. It is the only metric worth naming, and it settles most of the questions above
on its own.
