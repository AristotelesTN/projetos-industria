export type AppConfig = {
  NAO_URL: string;
};

declare global {
  interface Window {
    __APP_CONFIG__?: Partial<AppConfig>;
  }
}

export function getNaoUrl(): string {
  const fromWindow = window.__APP_CONFIG__?.NAO_URL?.replace(/\/$/, "");
  if (fromWindow) return fromWindow;
  const fromEnv = (import.meta.env.VITE_NAO_URL as string | undefined)?.replace(
    /\/$/,
    ""
  );
  return fromEnv || "http://localhost:5005";
}
