# Movie Discovery App

A modern movie discovery and tracking application built with React, TypeScript, Vite, and Firebase.

## Features

- AI-powered movie recommendations using Claude
- Smart orbit-based discovery system
- Multi-modal search (actors, genres, AI-curated)
- Personalized vibe lists
- Movie calendar and watchlist tracking
- YouTube trailer auto-play
- Rating badges from IMDb, Rotten Tomatoes, and Metacritic

## Development

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Vercel CLI (for local AI feature testing)

### Environment Variables

Create a `.env` file with the following keys:

```bash
VITE_CLAUDE_API_KEY=your_claude_api_key
VITE_TMDB_API_KEY=your_tmdb_api_key
VITE_OMDB_API_KEY=your_omdb_api_key
```

### Running Locally

**For basic UI testing (no AI features):**
```bash
npm run dev
```

**For full feature testing (including AI features):**

The AI features use Vercel serverless functions at `/api/claude`. To test these locally:

```bash
# Install Vercel CLI globally (one time only)
npm i -g vercel

# Run dev server with serverless function emulation
vercel dev
```

The Vercel dev server will:
- Start the Vite dev server
- Emulate the `/api/claude` serverless function locally
- Enable all AI features (recommendations, orbit, search vibes, etc.)

When prompted by Vercel CLI:
- Link to your Vercel project or create a new one
- Select your project settings
- The server will start on the port shown (usually 3000)

### Building for Production

```bash
npm run build
```

### Deployment

The app is configured to deploy automatically to Vercel on push to main:

```bash
git push origin main
```

Or manually deploy:

```bash
vercel --prod
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **Backend**: Firebase (Firestore, Auth)
- **AI**: Claude (Anthropic) via Vercel serverless functions
- **APIs**: TMDB, OMDb
- **Deployment**: Vercel

---

## Original Vite Template Info

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
