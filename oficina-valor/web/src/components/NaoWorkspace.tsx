import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

const PROMPTS = [
  'Quais projetos têm BRR abaixo de 70%?',
  'Compare hard vs soft savings validados no portfólio',
  'Mostre a curva S planejado vs realizado',
  'Liste medições pendentes na fila de homologação',
  'Top 5 projetos por ROI',
  'Ganhos por categoria (hard, soft, avoidance)',
  'Crie um Story com o resumo do portfólio e gráficos de BRR',
];

type NaoHealth = 'checking' | 'online' | 'offline';
type ViewMode = 'nao' | 'rapido';

type Msg = {
  role: 'user' | 'assistant';
  text: string;
  rows?: Record<string, unknown>[];
};

export function NaoWorkspace({
  onMessage,
  onError,
  initialPrompt,
  onInitialPromptConsumed,
}: {
  onMessage: (m: string) => void;
  onError: (e: string) => void;
  initialPrompt?: string | null;
  onInitialPromptConsumed?: () => void;
}) {
  const [mode, setMode] = useState<ViewMode>('nao');
  const [health, setHealth] = useState<NaoHealth>('checking');
  const [busy, setBusy] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [status, setStatus] = useState<any>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  /** URL pública do adaptador Nao (gráficos + Stories). Prefer VITE_NAO_URL. */
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  async function copyPrompt(q: string) {
    try {
      await navigator.clipboard.writeText(q);
      setCopied(q);
      window.setTimeout(() => setCopied(null), 2500);
      return true;
    } catch {
      return false;
    }
  }

  async function sync() {
    setBusy(true);
    try {
      const res = await api.syncNao();
      setLastSync(new Date().toLocaleString('pt-BR'));
      setStatus(await api.naoStatus());
      setIframeKey((k) => k + 1);
      void checkHealth();
      onMessage(
        res.ok
          ? `Nao sincronizado · ${res.written?.length ?? 0} CSVs · DuckDB OK`
          : `Sync parcial: ${res.buildStderr || res.error || 'verifique o DuckDB'}`,
      );
    } catch (e: any) {
      onError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function ask(question: string) {
    const q = question.trim();
    if (!q) return;
    setBusy(true);
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    try {
      const res = await api.askNao(q);
      setMsgs((m) => [
        ...m,
        { role: 'assistant', text: res.answer, rows: res.rows || [] },
      ]);
    } catch (e: any) {
      onError(e.message || String(e));
      setMsgs((m) => [
        ...m,
        { role: 'assistant', text: 'Não foi possível responder agora.' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  /** Agents / deep-link: no adaptador Nao, copia o prompt; no modo rápido, pergunta nativo. */
  useEffect(() => {
    if (!initialPrompt) return;
    const q = initialPrompt.trim();
    if (!q) {
      onInitialPromptConsumed?.();
      return;
    }
    if (mode === 'nao' && health !== 'offline') {
      setPendingPrompt(q);
      void copyPrompt(q).then((ok) => {
        if (ok) {
          onMessage('Prompt copiado — cole no chat Nao para gráficos e Stories');
        }
      });
      onInitialPromptConsumed?.();
      return;
    }
    setMode('rapido');
    void ask(q).finally(() => onInitialPromptConsumed?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  function usePrompt(q: string) {
    if (mode === 'nao') {
      setPendingPrompt(q);
      void copyPrompt(q);
      return;
    }
    void ask(q);
  }

  const duckReady = !!status?.duckdbExists;

  return (
    <div className={`nao-layout ${mode === 'rapido' ? 'native' : ''}`}>
      <aside className="nao-side">
        <div className="nao-side-head">
          <h2>Insights</h2>
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            Adaptador Nao · gráficos e Stories
          </p>
        </div>

        <div className="mode-toggle nao-mode-toggle" role="tablist" aria-label="Modo Insights">
          <button
            type="button"
            className={`mode-pill ${mode === 'nao' ? 'active' : ''}`}
            onClick={() => setMode('nao')}
          >
            Nao
          </button>
          <button
            type="button"
            className={`mode-pill ${mode === 'rapido' ? 'active' : ''}`}
            onClick={() => setMode('rapido')}
          >
            Rápido
          </button>
        </div>

        <div className="nao-status-row">
          <span
            className={`nao-dot is-${mode === 'nao' ? health : duckReady ? 'online' : 'offline'}`}
            aria-hidden
          />
          <span className="muted">
            {mode === 'nao' && health === 'checking' && 'Verificando Nao…'}
            {mode === 'nao' && health === 'online' && 'Nao online · charts/Stories'}
            {mode === 'nao' && health === 'offline' && 'Nao offline — use Rápido ou inicie o serviço'}
            {mode === 'rapido' && (duckReady ? 'DuckDB pronto · chat nativo' : 'Sincronize os dados')}
          </span>
        </div>

        <p className="muted" style={{ fontSize: 11, wordBreak: 'break-all', margin: '4px 0 0' }}>
          {naoUrl}
        </p>
        {status && (
          <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
            DuckDB: {duckReady ? 'pronto' : 'ausente — sincronize'}
            {lastSync ? ` · sync ${lastSync}` : ''}
          </p>
        )}

        <div className="actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn" disabled={busy} onClick={() => void sync()}>
            {busy ? 'Sincronizando…' : 'Sincronizar → Nao'}
          </button>
          {mode === 'nao' && (
            <>
              <button
                className="btn secondary"
                type="button"
                onClick={() => {
                  setIframeKey((k) => k + 1);
                  void checkHealth();
                }}
              >
                Recarregar
              </button>
              <a className="btn secondary" href={naoUrl} target="_blank" rel="noreferrer">
                Abrir Nao ↗
              </a>
            </>
          )}
        </div>

        {pendingPrompt && mode === 'nao' && (
          <div className="nao-pending-prompt">
            <strong>Prompt pronto</strong>
            <p className="muted" style={{ fontSize: 12, margin: '4px 0 8px' }}>
              {copied === pendingPrompt
                ? 'Copiado — cole no chat Nao (Ctrl/Cmd+V).'
                : 'Clique para copiar e cole no Nao.'}
            </p>
            <button
              type="button"
              className="nao-prompt"
              onClick={() => void copyPrompt(pendingPrompt)}
            >
              {pendingPrompt}
            </button>
          </div>
        )}

        <h3 style={{ marginTop: 20, fontSize: 13 }}>Perguntas sugeridas</h3>
        <ul className="nao-prompts">
          {PROMPTS.map((q) => (
            <li key={q}>
              <button
                type="button"
                className="nao-prompt"
                disabled={busy}
                onClick={() => usePrompt(q)}
              >
                {mode === 'nao' && copied === q ? 'Copiado!' : q}
              </button>
            </li>
          ))}
        </ul>

        <p className="muted" style={{ fontSize: 11, marginTop: 16 }}>
          Sessão do app: Gerente de Portfólio. O Nao usa o DuckDB sincronizado deste
          portfólio (gráficos, Stories e SQL).
        </p>
      </aside>

      <div className={`nao-main ${mode === 'rapido' ? 'native-chat' : ''}`}>
        {mode === 'nao' ? (
          health === 'offline' ? (
            <div className="nao-offline">
              <strong>Adaptador Nao inacessível</strong>
              <p className="muted">
                Inicie o serviço (<code>nao chat --port 5006</code> ou Docker) e
                sincronize os dados. Enquanto isso, use o modo <strong>Rápido</strong>{' '}
                (tabelas via API autenticada).
              </p>
              <button className="btn" type="button" onClick={() => setMode('rapido')}>
                Abrir modo Rápido
              </button>
            </div>
          ) : (
            <iframe
              key={iframeKey}
              className="nao-frame"
              title="Nao — Insights com gráficos e Stories"
              src={naoUrl}
              allow="clipboard-read; clipboard-write"
            />
          )
        ) : (
          <>
            <div className="chat-thread">
              {!msgs.length && (
                <div className="chat-bubble assistant">
                  <p>
                    Modo Rápido: respostas tabulares via API autenticada do app (sem
                    gráficos). Para charts e Stories, volte ao modo <strong>Nao</strong>.
                  </p>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={`chat-bubble ${m.role}`}>
                  <p>{m.text}</p>
                  {!!m.rows?.length && (
                    <div className="chat-table-wrap">
                      <table className="chat-table">
                        <thead>
                          <tr>
                            {Object.keys(m.rows[0]).map((k) => (
                              <th key={k}>{k}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {m.rows.map((row, ri) => (
                            <tr key={ri}>
                              {Object.keys(m.rows![0]).map((k) => (
                                <td key={k}>{String(row[k] ?? '—')}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <form className="chat-composer" onSubmit={onSubmit}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte sobre o portfólio…"
                disabled={busy}
              />
              <button className="btn" type="submit" disabled={busy || !input.trim()}>
                Enviar
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
