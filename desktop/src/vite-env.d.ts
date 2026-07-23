/// <reference types="vite/client" />

interface DoseCertaBridge {
  platform: string;
  apiBaseUrl: string;
}

interface Window {
  dosecerta?: DoseCertaBridge;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
