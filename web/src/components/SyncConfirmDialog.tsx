import { useEffect, useState } from "react";
import type { ChecklistItem } from "../lib/types";
import type { MockDataset } from "../lib/mock";
import { buildNaoSyncPayload, syncToNao } from "../lib/naoSync";
import {
  fingerprintCompanies,
  probeWriteTarget,
  saveSyncState,
  type SyncState,
} from "../lib/syncState";
import type { UserCompany } from "../lib/companyEval";

export function SyncConfirmDialog({
  open,
  onClose,
  dataset,
  items,
  userCompanies,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  dataset: MockDataset;
  items: ChecklistItem[];
  userCompanies: UserCompany[];
  onDone: (msg: string, state: SyncState) => void;
}) {
  const [target, setTarget] = useState<"disk" | "download" | "…">("…");
  const [busy, setBusy] = useState(false);
  const meta = buildNaoSyncPayload(dataset, items).meta;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    probeWriteTarget().then((t) => {
      if (!cancelled) setTarget(t);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  async function confirm() {
    setBusy(true);
    try {
      const result = await syncToNao(dataset, items);
      const next: SyncState = {
        lastSyncedAt: new Date().toISOString(),
        lastFingerprint: fingerprintCompanies(userCompanies),
        lastMeta: meta,
        lastMode: result.mode,
      };
      saveSyncState(next);
      onDone(result.message, next);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="sync-title">Sincronizar com Nao</h3>
        <p className="muted">
          Confirme o manifesto. Isto substitui a base DuckDB / CSVs do projeto{" "}
          <code>nao/</code> (mock + suas empresas).
        </p>
        <ul className="manifest">
          <li>
            <strong>{meta.nEmpresas}</strong> empresas
            <span className="muted">
              {" "}
              ({userCompanies.length} suas · {meta.nEmpresas - userCompanies.length}{" "}
              mock)
            </span>
          </li>
          <li>
            <strong>{meta.nAvaliacoes}</strong> avaliações
          </li>
          <li>
            Destino:{" "}
            <strong>
              {target === "disk"
                ? "disco local (DuckDB + restart container)"
                : target === "download"
                  ? "download do pack (Vercel / sem API)"
                  : "detectando…"}
            </strong>
          </li>
        </ul>
        <div className="toolbar-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || target === "…"}
            onClick={confirm}
          >
            {busy ? "Enviando…" : "Confirmar sync"}
          </button>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export function SyncStatusPill({
  dirty,
  syncState,
  onClick,
}: {
  dirty: boolean;
  syncState: SyncState;
  onClick: () => void;
}) {
  const label = dirty
    ? "Nao desatualizado"
    : syncState.lastSyncedAt
      ? "Nao sincronizado"
      : "Nao nunca sync";
  return (
    <button
      type="button"
      className={dirty ? "sync-pill dirty" : "sync-pill ok"}
      onClick={onClick}
      title={
        syncState.lastSyncedAt
          ? `Último sync: ${new Date(syncState.lastSyncedAt).toLocaleString("pt-BR")}`
          : "Ainda não sincronizou com o Nao"
      }
    >
      {label}
    </button>
  );
}
