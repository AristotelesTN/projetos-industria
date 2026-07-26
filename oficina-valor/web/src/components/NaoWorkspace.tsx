import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

const PROMPTS = [
  'Quais projetos têm BRR abaixo de 70%?',
  'Compare hard vs soft savings validados no portfólio',
  'Mostre a curva S planejado vs realizado',
  'Liste medições pendentes na fila de homologação',
  'Top 5 projetos por ROI',
  'Ganhos por categoria (hard, soft, avoidance)',
];

type NaoHealth = 'checking' | 'online' | 'offline';

export function NaoWorkspace({
  onMessage,
  onError,
}: {
  onMessage: (m: string) => void;
  onError: (e: string) => void;
}) {
  const [health, setHealth] = useState<NaoHealth>('checking');
  const [busy, setBusy] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [status, setStatus] = useState<any>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const naoUrl = api.naoUrl;

  const checkHealth = useCallback(async () => {
    setHealth('checking');
    try {
      const ctrl = new AbortController();
      const t = window.setTimeout(() => ctrl.abort(), 4000);
      await fetch(naoUrl, { mode: 'no-cors', signal: ctrl.signal });
      window.clearTimeout(t);
      setHealth('online');
    } catch {
      setHealth('offline');
    }
  }, [naoUrl]);

  useEffect(() => {
    void checkHealth();
    api
      .naoStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
    const id = window.setInterval(() => void checkHealth(), 30000);
    return () => window.clearInterval(id);
  }, [checkHealth]);

  async function sync() {
    setBusy(true);
    try {
      const res = await api.syncNao();
      setLastSync(new Date().toLocaleString('pt-BR'));
      onMessage(
        res.ok
          ? `Nao sincronizado · ${res.written?.length ?? 0} CSVs · DuckDB ${res.ok ? 'OK' : 'falhou'}`
          : `Sync parcial: ${res.buildStderr || res.error || 'verifique o DuckDB'}`,
      );
      setStatus(await api.naoStatus());
      setIframeKey((k) => k + 1);
      void checkHealth();
    } catch (e: any) {
      onError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function copyPrompt(q: string) {
    try {
      await navigator.clipboard.writeText(q);
      setCopied(q);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="nao-layout">
      <aside className="nao-side">
        <div className="nao-side-head">
          <h2>Nao</h2>
          <p className="muted">Analytics conversacional sobre o portfólio</p>
        </div>

        <div className="nao-status-row">
          <span className={`nao-dot is-${health}`} aria-hidden />
          <span className="muted">
            {health === 'checking' && 'Verificando…'}
            {health === 'online' && 'Chat online'}
            {health === 'offline' && 'Chat offline — inicie o Nao'}
          </span>
        </div>

        <p className="muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>
          {naoUrl}
        </p>
        {status && (
          <p className="muted" style={{ fontSize: 12 }}>
            DuckDB: {status.duckdbExists ? 'pronto' : 'ausente — sincronize'}
            {lastSync ? ` · sync ${lastSync}` : ''}
          </p>
        )}

        <div className="actions" style={{ marginTop: 8 }}>
          <button className="btn" disabled={busy} onClick={sync}>
            {busy ? 'Sincronizando…' : 'Sincronizar dados → Nao'}
          </button>
          <button
            className="btn secondary"
            onClick={() => {
              setIframeKey((k) => k + 1);
              void checkHealth();
            }}
          >
            Recarregar chat
          </button>
          <a className="btn secondary" href={naoUrl} target="_blank" rel="noreferrer">
            Abrir Nao ↗
          </a>
        </div>

        <h3 style={{ marginTop: 20, fontSize: 13 }}>Perguntas sugeridas</h3>
        <ul className="nao-prompts">
          {PROMPTS.map((q) => (
            <li key={q}>
              <button type="button" className="nao-prompt" onClick={() => copyPrompt(q)}>
                {copied === q ? 'Copiado!' : q}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="nao-main">
        {health === 'offline' ? (
          <div className="nao-offline">
            <strong>Nao não está acessível</strong>
            <p className="muted">
              No servidor: <code>cd oficina-valor/nao && nao chat --port 5006</code>
              <br />
              Depois sincronize os dados do portfólio e recarregue o chat.
            </p>
          </div>
        ) : (
          <iframe
            key={iframeKey}
            className="nao-frame"
            title="Nao chat"
            src={naoUrl}
            allow="clipboard-read; clipboard-write"
          />
        )}
      </div>
    </div>
  );
}
