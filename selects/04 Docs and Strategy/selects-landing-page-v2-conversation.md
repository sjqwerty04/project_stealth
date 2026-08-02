# Selects — Alternate Landing Page Build (Conversation Log)

*Session: 2026-04-27*
*Working dir: `/Users/jarvis/Desktop/Selects/`*
*Model: Claude Haiku 4.5 → Opus 4.7 (after `/model opus`)*

---

## User

> Read the market research folder in this and also the PDF, and then use your copywriting skill to come up with an alternate landing page with some content on it. You can even, for the new landing page, change it in a way and use your landing page skill and copywriting skill to come up with text for the entire page. Use the market research text to research the information you need to come up with that content.
>
> and then ask me clarifying questions if needed

## Assistant

Read inputs:

- `Market Research/Selects AI — Market Research.pdf` — TAM/SAM/SOM, decision-fatigue stats (49% give up, 110 hrs/yr, 27.8% streaming fatigue), competitive landscape (Netflix, Letterboxd, JustWatch, MUBI, Queue), four target personas, GTM geography.
- `selects-full-strategy.md` — locked brand voice rules, vocabulary allow/deny lists, taglines, feature names (Orbit, The Pull, The Word, The Reel, Soul), LinkedIn V2 article with the five-tier discovery model.
- Existing landing page: `Selects Landing Page/src/` — Next.js 16 / React app with components: HeroSection, FilmStripScroll, ProcessCard, DiscoverCards, OriginStory, SoulCTA, OnboardingFlow, Footer.

Flagged that no explicit "copywriting" or "landing-page" skills are installed; closest are `ui-ux-pro-max` and `market-research`. Worked from the brand voice rules already locked in `selects-full-strategy.md` §4.

Asked three clarifying questions:

1. **Page setup** — new route, replace, or copy doc only?
2. **Angle** — data/proof, taste-identity, anti-algorithm manifesto, or Spotify-for-film?
3. **Components** — reuse, fresh structure, or hybrid?

## User answers

- **Page setup:** Copy doc only, no code.
- **Angle:** Combination of 1, 2, and 3 with a ratio of 25 : 35 : 40.
- **Components:** Hybrid.

## Assistant

Wrote plan to `/Users/jarvis/.claude/plans/and-then-ask-me-cosmic-seahorse.md` with full draft copy embedded so the user could review actual content during plan approval. Plan documented:

- Voice mix: 40% anti-algorithm manifesto · 35% taste-identity · 25% data/proof.
- Voice guardrails (allow/deny vocabulary from §4 of strategy doc).
- Page map of 10 sections — 8 reuse existing components, 2 new (Stats Band, Five Tiers of Discovery).
- Final draft copy section-by-section.
- Deliverable: save as `selects-landing-page-v2.md` at project root.

Called `ExitPlanMode`.

## User

> *Plan approved.*

## Assistant

Saved `/Users/jarvis/Desktop/Selects/selects-landing-page-v2.md` — full alternate landing page copy doc.

## User

> Go builds it

## Assistant

Built the alternate landing page. Changes:

### New components

- `src/components/StatsBand/StatsBand.tsx` — 49% / 110 hrs / 481-of-9,000 stat trio with the *"You are not bad at finding films"* closer + sources line.
- `src/components/FiveTiers/FiveTiers.tsx` — five-tier discovery model from the LinkedIn V2 article. Tiers 1–2 dimmed (*Solved*), 3–5 highlighted in accent (*Ours*).

### Rewritten copy in existing components

- **`Hero/HeroCopy.tsx`** — *"The algorithm never knew you. / Selects does."* + CTA *"Find your film →"* + micro-copy *"No algorithm. No agenda. No noise."*
- **`FilmStrip/FilmStripScroll.tsx`** — opens with *Moana / 50,000 titles*; "corporate money" → "the film a committee approved."
- **`ProcessCard.tsx` + `processData.ts`** — headline *"Four swipes. Five minutes. Your film."*; steps renamed to **The Reel → Orbit → The Pull → Your Select**.
- **`DiscoverCards.tsx`** — *"Swipe toward what pulls you."* with the Orbit four-direction map shown above the cards; success state *"Four swipes in. Selects already knows you."*
- **`FilmStrip/OriginStory.tsx`** — fully rewritten as the manifesto (*"You've been here before. Forty minutes. Nothing. Again." → "Selects does." → "You are not everyone."*).
- **`Soul/SoulCTA.tsx`** — *"Your taste, finally readable."* + CTA *"Activate your Soul →"* + Off-White move: *Tonight's pick. "Personalised."*
- **`Onboarding/WaitlistForm.tsx`** — submit *"Find my film →"*; success *"You're on the list. Tonight's still on you. The next one is on us."*
- **`Footer.tsx`** — tagline now *"Blocks away from the noise."*

### Page composition

`src/app/page.tsx` flow: Hero → **StatsBand** → FilmStrip → **FiveTiers** → ProcessCard → DiscoverCards → OriginStory → SoulCTA → Onboarding → Footer.

### Verification

- `npx tsc --noEmit` — only pre-existing errors in `src/components/ui/3d-card.tsx` (unrelated, not used by my changes).
- `npm run dev` → curl `/` → HTTP 200, compiled in ~138ms application code.

## User

> run and show me the page

## Assistant

Started dev server on port 3000, verified HTTP 200, opened `http://localhost:3000/` in default browser.

## User

> Save the md file and our conversation as an md file in this directory

## Assistant

Confirmed `selects-landing-page-v2.md` already saved at project root. Wrote this conversation log to `selects-landing-page-v2-conversation.md` alongside it.

---

## Files produced this session

| File | Purpose |
|---|---|
| `/Users/jarvis/Desktop/Selects/selects-landing-page-v2.md` | Alternate landing page copy doc |
| `/Users/jarvis/Desktop/Selects/selects-landing-page-v2-conversation.md` | This log |
| `Selects Landing Page/src/components/StatsBand/StatsBand.tsx` | New section |
| `Selects Landing Page/src/components/FiveTiers/FiveTiers.tsx` | New section |
| `Selects Landing Page/src/components/Hero/HeroCopy.tsx` | Rewritten copy |
| `Selects Landing Page/src/components/FilmStrip/FilmStripScroll.tsx` | Rewritten copy |
| `Selects Landing Page/src/components/FilmStrip/OriginStory.tsx` | Rewritten manifesto |
| `Selects Landing Page/src/components/ProcessCard/ProcessCard.tsx` | Updated headline |
| `Selects Landing Page/src/components/ProcessCard/processData.ts` | Renamed steps |
| `Selects Landing Page/src/components/DiscoverCards/DiscoverCards.tsx` | Rewritten framing |
| `Selects Landing Page/src/components/Soul/SoulCTA.tsx` | Rewritten copy |
| `Selects Landing Page/src/components/Onboarding/WaitlistForm.tsx` | Rewritten micro-copy |
| `Selects Landing Page/src/components/Footer.tsx` | Updated tagline |
| `Selects Landing Page/src/app/page.tsx` | Wired in 2 new sections |
