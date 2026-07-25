# Questions — round 2

Round 1 is answered and locked in [DECISIONS.md](DECISIONS.md). These are what your answers
opened up. Nine, down from twenty-seven, and they're narrower because the shape is settled.

Three are **BLOCKING** — I'd build the wrong thing if I guessed.

---

## A. Focus

**1. BLOCKING — Is Focus a number, or a state?**

A number (0–100) is checkable, moves visibly, and is the thing you screenshot. It is also the
thing users try to game, and a low one can read as an accusation — nobody enjoys being told
they're a 38.

A state — *soft / settling / sharp / locked* — is warmer, unfakeable and matches the visual
metaphor, but you can't watch it climb, and half the reason to open the app on a Tuesday is
watching it climb.

My instinct: **the number, with the word underneath.** "38 · soft." The number gives you the
climb, the word gives you the tone. But this is the single most-seen element in the product
and I'd rather you picked it.

**2. How hard should Focus decay?**

This is the dial that decides whether the app feels like a companion or a nag.

- **Gentle** — noticeable after a week. Forgiving. Weak pull.
- **Firm** — noticeable after three days. Real pull. Some guilt.
- **Sharp** — visible daily. Strong pull, and it will make some people feel bad about
  a busy fortnight.

Duolingo chose sharp and it works, but a language streak is a five-minute commitment and a
film is two hours — the same pressure lands very differently. I'd start **firm** and watch
what happens to logging rate versus uninstalls. Your call on the starting point.

**3. Can Focus be low and the Ticket still be good?**

Honestly: at Focus 30 the three picks are near-guesses. Two options. Either the Ticket says so
— *"low confidence, this is a guess"* — which is honest and builds trust but advertises
weakness on the screen the user sees most. Or it never admits it and quietly leans on
popularity, which feels better and is a small lie.

I lean toward admitting it, because your whole trust argument in Q11 was that inferred signals
compound their error. But it costs something on day one, when everyone's Focus is low.

---

## B. The Ticket

**4. BLOCKING — What is behind the tear?**

The reward has to be variable or it stops working by week two. Four candidates, and I need to
know which feel like *you*:

| Behind the stub | Feels like |
|---|---|
| **A B-side** — a second, stranger film that pairs with the first | a mixtape |
| **Canon** — a fact about the film nobody told them | feeling smart, which you named as the goal |
| **A facet unlocking** — a new room opens in the Assembly | progression |
| **A one-liner about them** — "you've picked three films about competence this week" | being known |

They can all exist and rotate — that's what makes it variable. But one of them should be the
common case, and that one sets the emotional register of the whole product. My guess is
**canon**, because "a regular user feels smart" was your answer to Q19.

**5. What happens to the two stubs they didn't tear?**

Gone at midnight is dramatic and creates real urgency. Rolling into a "missed" pile is kinder
and lets you learn from what they *keep* passing on, which is a strong negative signal you'd
otherwise throw away.

Cinema's own answer is that a ticket expires. I'd expire them visibly — but log the passes
silently, because a rejected stub tells you as much as a torn one.

---

## C. Taste

**6. Give me twenty facets in your own words.**

Not the eight axes — I've specified those. I mean the actual terms. `DIRECTION.md §7` has my
guesses: *sodium-and-cyan night, competence porn, dread accumulating, nobody wins*. Some of
those are probably right and some are probably me writing like a critic instead of like you.

Twenty of yours — for films you love, in the words you'd actually use to a friend — calibrates
the entire seed corpus. It is thirty minutes of your time and it is the highest-leverage thing
you can personally do for this product. Everything the app ever says about a film inherits
from those twenty.

**7. BLOCKING — Does a user ever see the whole vocabulary?**

Two very different products.

**Hidden:** facets only appear on films and in rooms you arrive at. The vocabulary is
infrastructure. Feels magical, and mapping the territory is impossible — you can only wander.

**Browsable:** there's an index. All eight axes, every term, tap anything. Feels like a
library, rewards the obsessive, and makes the app a reference tool as well as a
recommender — which is closer to your answer to Q27 about replacing IMDb.

Hidden is more magical. Browsable is more useful, and your user zero is a completist. I lean
browsable but buried — reachable, not advertised.

**8. When Layer 2 renames a facet for someone, do they know?**

If your app calls it *sodium-and-cyan night* and your friend's calls the identical thing
*that Michael Mann blue*, that's the personalisation working. But if you ever compare screens
— and with a public Assembly and a match percentage, you will — one of you finds out the app
has a different voice for the other person.

That's either delightful or unsettling, and which one depends entirely on whether they were
told it was happening. My instinct is that the personalisation is invisible until two people
compare, and at that moment it should be framed as a feature, not discovered as a
discrepancy.

---

## D. The Cut

**9. What is the bar for earning it?**

You said 20–25 films a month describes a real cinephile. If the threshold is 20, most users
never see the Cut and it becomes a thing they hear about. If it's 5, almost everyone gets one
and it stops being an achievement — and your render bill scales with your user count instead
of with your power users.

There's a third shape: **the Cut's length is what's earned.** Everyone gets one; five films
buys you fifteen seconds, twenty buys you a minute. Nobody is excluded, the incentive is
continuous rather than a cliff, and cost scales with engagement instead of with signups.

I prefer the third. But a cliff makes a better thing to brag about, and you know this
audience better than I do.

---

## Not asking, but flagging

Three things I'll assume unless you say otherwise:

- **The Verdict push needs a start time on the log.** That's a schema change to
  `calendar_logs`, and it's what makes 11:40pm work. I'm treating it as agreed.
- **Letterboxd RSS is the import path for the instant reveal**, with CSV as the deeper
  second pass. If Letterboxd's terms turn out to prohibit it, the whole onboarding sequence
  needs rethinking, so it's worth someone reading them before this gets built.
- **The clapstick needs a trademark and visual-similarity check** before it goes on a store
  listing. Diagonal bars are less crowded than rings, but it should still be cleared.
