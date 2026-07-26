import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, getUser } from '../lib/api';

const PROMPTS = [
  'Quais projetos têm BRR abaixo de 70%?',
  'Compare hard vs soft savings validados no portfólio',
  'Mostre a curva S planejado vs realizado',
  'Liste medições pendentes na fila de homologação',
  'Top 5 projetos por ROI',
  'Ganhos por categoria (hard, soft, avoidance)',
  'Crie um Story com o resumo do portfólio e gráficos de BRR',
];

const LS_ONBOARDED = 'ov_nao_onboarded_v1';
const LS_EMBED = 'ov_nao_prefer_embed_v1';

type NaoHealth = 'checking' | 'online' | 'offline';
type ViewMode = 'nao' | 'rapido';
type NaoSurface = 'onboard' | 'tab' | 'embed';

type Msg = {
  role: 'user' | 'assistant';
  text: string;
  rows?: Record<string, unknown>[];
};

function readFlag(key: string) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

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
  const [onboarded, setOnboarded] = useState(() => readFlag(LS_ONBOARDED));
  const [preferEmbed, setPreferEmbed] = useState(() => readFlag(LS_EMBED));
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const naoWindowRef = useRef<Window | null>(null);

  const naoUrl = api.naoUrl;
  const user = getUser();

  const crossOrigin = useMemo(() => {
    try {
      return new URL(naoUrl, window.location.href).origin !== window.location.origin;
    } catch {
      return true;
    }
  }, [naoUrl]);

  /** Aba dedicada é o caminho recomendado (sessão Better Auth do Nao). */
  const surface: NaoSurface = !onboarded
    ? 'onboard'
    : preferEmbed && !crossOrigin
      ? 'embed'
      : preferEmbed && crossOrigin
        ? 'embed'
        : 'tab';

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

  function openNaoTab(withPrompt?: string | null) {
    if (withPrompt) void copyPrompt(withPrompt);
    const w = window.open(naoUrl, 'oficina-nao-chat');
    naoWindowRef.current = w;
    if (!w) {
      onError('Popup bloqueado — permita pop-ups ou use o link Abrir Nao');
      return;
    }
    onMessage(
      withPrompt
        ? 'Nao aberto — cole o prompt (Ctrl/Cmd+V) após entrar'
        : 'Nao aberto em nova aba — entre uma vez e volte aqui',
    );
  }

  function markOnboarded() {
    writeFlag(LS_ONBOARDED, true);
    setOnboarded(true);
  }

  function chooseTabSurface() {
    writeFlag(LS_EMBED, false);
    setPreferEmbed(false);
    markOnboarded();
    openNaoTab(pendingPrompt);
  }

  function chooseEmbedSurface() {
    writeFlag(LS_EMBED, true);
    setPreferEmbed(true);
    markOnboarded();
    setIframeKey((k) => k + 1);
    onMessage(
      crossOrigin
        ? 'Painel embed ativo — se pedir login, use Abrir Nao ↗ na mesma sessão do navegador'
        : 'Painel embed ativo',
    );
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
        if (ok) onMessage('Prompt copiado — abra o Nao e cole para gráficos/Stories');
      });
      if (onboarded && surface !== 'onboard') openNaoTab(q);
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
      if (onboarded) openNaoTab(q);
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
            {mode === 'nao' && health === 'offline' && 'Nao offline — use Rápido'}
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

        <div className="nao-auth-note">
          <strong>Sessões</strong>
          <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
            App: {user?.nome || 'Gerente'} (Oficina). Nao: login próprio uma vez — recomendado
            {crossOrigin ? ' em nova aba (origem diferente).' : '.'}
          </p>
        </div>

        <div className="actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn" disabled={busy} onClick={() => void sync()}>
            {busy ? 'Sincronizando…' : 'Sincronizar → Nao'}
          </button>
          {mode === 'nao' && (
            <>
              <button
                className="btn"
                type="button"
                disabled={health === 'offline'}
                onClick={() => openNaoTab(pendingPrompt)}
              >
                Abrir Nao ↗
              </button>
              <button
                className="btn secondary"
                type="button"
                onClick={() => {
                  writeFlag(LS_ONBOARDED, false);
                  setOnboarded(false);
                }}
              >
                Refazer setup
              </button>
            </>
          )}
        </div>

        {pendingPrompt && mode === 'nao' && (
          <div className="nao-pending-prompt">
            <strong>Prompt pronto</strong>
            <p className="muted" style={{ fontSize: 12, margin: '4px 0 8px' }}>
              {copied === pendingPrompt
                ? 'Copiado — cole no Nao (Ctrl/Cmd+V).'
                : 'Clique para copiar e abra o Nao.'}
            </p>
            <button
              type="button"
              className="nao-prompt"
              onClick={() => {
                void copyPrompt(pendingPrompt);
                openNaoTab(pendingPrompt);
              }}
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
                {mode === 'nao' && copied === q ? 'Copiado · abrir Nao' : q}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className={`nao-main ${mode === 'rapido' ? 'native-chat' : ''}`}>
        {mode === 'nao' ? (
          health === 'offline' ? (
            <div className="nao-offline">
              <strong>Adaptador Nao inacessível</strong>
              <p className="muted">
                Inicie o serviço (<code>nao chat --port 5006</code> ou Docker) e sincronize.
                Enquanto isso, use o modo <strong>Rápido</strong>.
              </p>
              <button className="btn" type="button" onClick={() => setMode('rapido')}>
                Abrir modo Rápido
              </button>
            </div>
          ) : surface === 'onboard' ? (
            <div className="nao-onboard">
              <p className="nao-onboard-kicker">Setup · 1 vez</p>
              <h3>Entrar no Nao para gráficos e Stories</h3>
              <p className="muted">
                O login do <strong>Oficina de Valor</strong> já está ativo. O Nao tem autenticação
                própria (Better Auth) — não dá para desligar. Faça o login <em>uma vez</em> na aba
                do Nao; depois use prompts daqui (copiar + colar).
              </p>
              <ol className="nao-onboard-steps">
                <li>
                  <strong>Sincronizar</strong> o portfólio para o DuckDB
                </li>
                <li>
                  <strong>Abrir Nao</strong> em nova aba e concluir o primeiro acesso
                </li>
                <li>
                  Voltar e usar perguntas sugeridas (prompt copiado automaticamente)
                </li>
              </ol>
              <div className="nao-onboard-actions">
                <button className="btn" disabled={busy} onClick={() => void sync()}>
                  {busy ? 'Sincronizando…' : '1. Sincronizar dados'}
                </button>
                <button className="btn" type="button" onClick={chooseTabSurface}>
                  2. Abrir Nao e entrar ↗
                </button>
                <button className="btn secondary" type="button" onClick={chooseEmbedSurface}>
                  Já entrei — tentar painel
                </button>
                <button className="btn secondary" type="button" onClick={() => setMode('rapido')}>
                  Pular · modo Rápido
                </button>
              </div>
              {crossOrigin && (
                <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
                  Nao está em outra origem ({naoUrl}). Cookies do iframe podem falhar — a aba
                  dedicada é o caminho mais estável.
                </p>
              )}
            </div>
          ) : surface === 'embed' || preferEmbed ? (
            <div className="nao-embed-wrap">
              <div className="nao-embed-bar">
                <span className="muted" style={{ fontSize: 12 }}>
                  Painel embed · se pedir login, use a aba
                </span>
                <div className="top-actions">
                  <button className="btn secondary" type="button" onClick={() => openNaoTab()}>
                    Abrir Nao ↗
                  </button>
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
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => {
                      writeFlag(LS_EMBED, false);
                      setPreferEmbed(false);
                    }}
                  >
                    Só aba
                  </button>
                </div>
              </div>
              <iframe
                key={iframeKey}
                className="nao-frame"
                title="Nao — Insights com gráficos e Stories"
                src={naoUrl}
                allow="clipboard-read; clipboard-write"
              />
            </div>
          ) : (
            <div className="nao-tab-hero">
              <strong>Nao pronto na aba</strong>
              <p className="muted">
                Use <strong>Abrir Nao ↗</strong> ou uma pergunta sugerida. O prompt é copiado;
                cole no chat do Nao para charts e Stories sobre o DuckDB sincronizado.
              </p>
              <div className="nao-onboard-actions">
                <button className="btn" type="button" onClick={() => openNaoTab(pendingPrompt)}>
                  Abrir / focar Nao ↗
                </button>
                <button className="btn secondary" type="button" onClick={chooseEmbedSurface}>
                  Mostrar no painel
                </button>
              </div>
            </div>
          )
        ) : (
          <>
            <div className="chat-thread">
              {!msgs.length && (
                <div className="chat-bubble assistant">
                  <p>
                    Modo Rápido: tabelas via API autenticada do app (sem gráficos). Para charts e
                    Stories, volte ao modo <strong>Nao</strong>.
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
