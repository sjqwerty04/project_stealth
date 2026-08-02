# Selects Assets

Everything related to the Selects landing pages, collected on 2 Aug 2026.

## Contents

**01 Landing Page — Animated (Next.js)**
The full animated landing page. Next.js + TypeScript + Tailwind. Sections: Hero (film reel rings), Stats band, Film strip scroll, Five Tiers, Process cards, Discover cards (3D / draggable), Origin story, Cinematic Soul CTA (mosaic effect), Onboarding + waitlist flow, Footer. Includes API routes for waitlist, film search/stills/trailers, persona generation and upload.
Run with: `npm install && npm run dev`

**02 Landing Page — Lightweight (split-screen)**
The stripped-down version: split-screen Selects / Premise panels that expand on click. Only three components (FilmRings, DottedCanvas, SelectsOrbit) and no dependencies beyond Next + React. Matches the screenshots in folder 03.
Run with: `npm install && npm run dev`

**03 Landing Page Images**
`01-split-screen.png` — default split state.
`02-selects-expanded.png` — Selects panel expanded.

**04 Docs and Strategy**
- `selects-landing-page-v2.md` — full v2 copy doc, section by section, with component mapping
- `selects-landing-page-v2-conversation.md` — working notes behind v2
- `selects-full-strategy.md` — brand, voice rules and positioning
- `Selects AI — Market Research.pdf`
- `selects-positioning-asset.docx` — positioning one-pager
- `landing-page-README.md` / `landing-page-AGENTS.md` — project setup notes

**05 Data**
Investor tracker, Reddit user list, US strategic partners.

**06 Screenshots**
Early landing page screenshots (April 2026) and a reference image.

**07 Selects Travel**
Travel prototype. Single-page React-in-HTML build — open `Selects.html` directly in a browser, no build step. Screens: lock, explore, detail. Includes an interactive globe (`globe.jsx`), an iOS device frame (`ios-frame.jsx`), a tweaks panel for live parameter tuning, and `scratch/` reference renders.

## Notes

- `node_modules`, `.next`, `.git` and build caches were left out to keep this portable. Both projects rebuild from `package.json`.
- **Environment files were deliberately excluded.** The animated project needs a `.env.local` with its API keys (TMDB, OpenRouter, etc.) to run — the original is still in the source folder on the Desktop. Don't send keys along with this bundle.
