/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  /** "true" para usar os emuladores locais (npm run emuladores). */
  readonly VITE_FIREBASE_EMULADOR?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
