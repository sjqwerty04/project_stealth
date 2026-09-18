/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

declare module '*.md?raw' {
  const content: string;
  export default content;
}
interface ImportMetaEnv {
  readonly VITE_SELECTS_SHA?: string;
  readonly VITE_TMDB_API_KEY?: string;
  readonly VITE_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
