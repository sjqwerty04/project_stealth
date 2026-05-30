/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

declare module '*.md?raw' {
  const content: string;
  export default content;
}
declare module '*.md' {
  const content: string;
  export default content;
}
