/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONNECT_LIVE_ENABLED?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
