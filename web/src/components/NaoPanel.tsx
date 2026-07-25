import { useCallback, useEffect, useMemo, useState } from "react";
import type { MockDataset } from "../lib/mock";
import { getNaoUrl } from "../lib/runtimeConfig";
import { pct } from "../lib/types";
import type { SyncState } from "../lib/syncState";

const PROMPTS = [
  "Top 10 empresas por cobertura média",
  "Compare cobertura média por setor e por maturidade_ia",
  "Quais pilares estão mais fracos no mercado?",
  "Empresas líderes com gaps (Não tem) no pilar 6",
  "Distribuição de decisões Comprar vs Construir vs Híbrido",
  "Liste softwares industriais (Siemens, Cognite…) e compare cobertura no pilar 1",
];

type NaoHealth = "checking" | "online" | "offline";

export function NaoPanel({
  dataset,
  userCount,
  dirty,
  syncState,
  onRequestSync,
}: {
  dataset: MockDataset;
  userCount: number;
  dirty: boolean;
  syncState: SyncState;
  onRequestSync: () => void;
}) {
  const naoUrl = getNaoUrl();
  const [health, setHealth] = useState<NaoHealth>("checking");
  const [iframeKey, setIframeKey] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const avg = useMemo(
    () =>
      dataset.empresas.reduce((s, e) => s + e.coberturaMedia, 0) /
      (dataset.empresas.length || 1),
    [dataset.empresas]
  );
  const nAv = useMemo(
    () =>
      Object.values(dataset.avaliacoes).reduce((s, rows) => s + rows.length, 0),
    [dataset.avaliacoes]
  );
  const top = useMemo(
    () =>
      [...dataset.empresas]
        .sort((a, b) => b.coberturaMedia - a.coberturaMedia)
        .slice(0, 5),
    [dataset.empresas]
  );

  const checkHealth = useCallback(async () => {
    setHealth("checking");
    try {
      const ctrl = new AbortController();
      const t = window.setTimeout(() => ctrl.abort(), 3500);
      await fetch(naoUrl, { mode: "no-cors", signal: ctrl.signal });
      window.clearTimeout(t);
      // no-cors: opaque success ≈ reachable
      setHealth("online");
    } catch {
      setHealth("offline");
    }
  }, [naoUrl]);

  useEffect(() => {
    void checkHealth();
    const id = window.setInterval(() => void checkHealth(), 45000);
    return () => window.clearInterval(id);
  }, [checkHealth]);

  async function copyPrompt(q: string) {
    try {
      await navigator.clipboard.writeText(q);
      setCopied(q);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  function reloadChat() {
    setIframeKey((k) => k + 1);
    void checkHealth();
  }

  return (
    <div className={`nao-workspace ${sidebarOpen ? "" : "is-collapsed"}`}>
      <aside className="nao-sidebar">
        <div className="nao-sidebar-head">
          <div>
            <p className="eyebrow">Passo 3 · Agente</p>
            <h2>Nao</h2>
          </div>
          <button
            type="button"
            className="btn ghost nao-collapse"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? "Recolher painel" : "Expandir painel"}
            title={sidebarOpen ? "Recolher" : "Expandir"}
          >
            {sidebarOpen ? "‹" : "›"}
          </button>
        </div>

        {sidebarOpen ? (
          <>
            <div className="nao-status-row">
              <span
                className={`nao-status-dot is-${health}`}
                aria-hidden
              />
              <span className="muted tiny">
                {health === "checking" && "Verificando Nao…"}
                {health === "online" && `Online · ${naoUrl}`}
                {health === "offline" &&
                  "Nao inacessível — confira Docker (:5005)"}
              </span>
            </div>

            <div className={`nao-sync-card ${dirty ? "is-dirty" : "is-ok"}`}>
              <strong>
                {dirty ? "Base desatualizada" : "Base sincronizada"}
              </strong>
              <p className="muted tiny">
                {syncState.lastSyncedAt
                  ? `Último sync: ${new Date(
                      syncState.lastSyncedAt
                    ).toLocaleString("pt-BR")}`
                  : "Ainda sem sync nesta sessão."}
              </p>
              <div className="toolbar-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onRequestSync}
                >
                  {dirty ? "Sync agora…" : "Sync Nao…"}
                </button>
              </div>
            </div>

            <div className="nao-mini-stats">
              <div>
                <strong>{dataset.empresas.length}</strong>
                <span>Empresas</span>
              </div>
              <div>
                <strong>{nAv}</strong>
                <span>Avaliações</span>
              </div>
              <div>
                <strong>{pct(avg)}</strong>
                <span>Cobertura</span>
              </div>
              <div>
                <strong>{userCount}</strong>
                <span>Suas</span>
              </div>
            </div>

            <section className="nao-section">
              <h3>Perguntas rápidas</h3>
              <p className="muted tiny">
                Clique para copiar e cole no chat ao lado.
              </p>
              <ul className="nao-prompt-list">
                {PROMPTS.map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      className="nao-prompt-btn"
                      onClick={() => void copyPrompt(q)}
                    >
                      {copied === q ? "Copiado ✓" : q}
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {top.length > 0 ? (
              <section className="nao-section">
                <h3>Top cobertura</h3>
                <ul className="nao-top-list">
                  {top.map((e) => (
                    <li key={e.id}>
                      <span className="nao-top-name">{e.nome}</span>
                      <span className="nao-top-pct">{pct(e.coberturaMedia)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="nao-sidebar-actions">
              <button type="button" className="btn" onClick={reloadChat}>
                Recarregar chat
              </button>
              <a className="btn" href={naoUrl} target="_blank" rel="noreferrer">
                Abrir em nova aba
              </a>
            </div>
          </>
        ) : null}
      </aside>

      <section className="nao-chat-pane">
        <header className="nao-chat-bar">
          <div>
            <strong>Chat analítico</strong>
            <span className="muted tiny">
              {" "}
              · DuckDB do projeto <code>nao/</code>
            </span>
          </div>
          <div className="toolbar-row">
            {!sidebarOpen ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() => setSidebarOpen(true)}
              >
                Contexto
              </button>
            ) : null}
            {dirty ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onRequestSync}
              >
                Sync pendente
              </button>
            ) : null}
            <button type="button" className="btn" onClick={reloadChat}>
              Recarregar
            </button>
          </div>
        </header>

        {health === "offline" ? (
          <div className="nao-offline">
            <h3>Nao não respondeu</h3>
            <p className="muted">
              Suba a stack com <code>docker compose up -d</code> e confira{" "}
              <a href={naoUrl} target="_blank" rel="noreferrer">
                {naoUrl}
              </a>
              . Depois clique em Recarregar.
            </p>
            <div className="toolbar-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={reloadChat}
              >
                Tentar de novo
              </button>
              <button type="button" className="btn" onClick={onRequestSync}>
                Sync Nao…
              </button>
            </div>
          </div>
        ) : (
          <iframe
            key={iframeKey}
            className="nao-embed"
            title="Nao chat"
            src={naoUrl}
            referrerPolicy="no-referrer"
            allow="clipboard-read; clipboard-write"
          />
        )}
      </section>
    </div>
  );
}
