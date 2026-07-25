export const SYNC_STATE_KEY = "plataforma-ia-industrial-sync-v1";

export type SyncState = {
  lastSyncedAt: string | null;
  lastFingerprint: string | null;
  lastMeta: { nEmpresas: number; nAvaliacoes: number } | null;
  lastMode: "api" | "download" | null;
};

export function loadSyncState(): SyncState {
  try {
    const raw = localStorage.getItem(SYNC_STATE_KEY);
    if (!raw) {
      return {
        lastSyncedAt: null,
        lastFingerprint: null,
        lastMeta: null,
        lastMode: null,
      };
    }
    return JSON.parse(raw) as SyncState;
  } catch {
    return {
      lastSyncedAt: null,
      lastFingerprint: null,
      lastMeta: null,
      lastMode: null,
    };
  }
}

export function saveSyncState(state: SyncState) {
  localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
}

/** Fingerprint of user companies only (mock seed is static). */
export function fingerprintCompanies(payload: unknown): string {
  const json = JSON.stringify(payload);
  let h = 2166136261;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export async function probeWriteTarget(): Promise<"disk" | "download"> {
  try {
    const res = await fetch("/api/nao-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ probe: true }),
    });
    if (!res.ok) return "download";
    const data = (await res.json()) as { writeTarget?: string };
    if (data.writeTarget === "disk") return "disk";
  } catch {
    /* production */
  }
  return "download";
}
