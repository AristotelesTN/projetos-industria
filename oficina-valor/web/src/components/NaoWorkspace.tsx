import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

const PROMPTS = [
  'Quais projetos têm BRR abaixo de 70%?',
  'Compare hard vs soft savings validados no portfólio',
  'Mostre a curva S planejado vs realizado',
  'Liste medições pendentes na fila de homologação',
  'Top 5 projetos por ROI',
  'Ganhos por categoria (hard, soft, avoidance)',
];

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
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .naoStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  async function sync() {
    setBusy(true);
    try {
      const res = await api.syncNao();
      setStatus(await api.naoStatus());
      onMessage(
        res.ok
          ? `Dados sincronizados · ${res.written?.length ?? 0} CSVs · DuckDB OK`
          : `Sync parcial: ${res.buildStderr || 'verifique o DuckDB'}`,
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
    void ask(initialPrompt).finally(() => onInitialPromptConsumed?.());
    // intentionally only when agent navigation injects a prompt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <div className="nao-layout native">
      <aside className="nao-side">
        <div className="nao-side-head">
          <h2>Insights</h2>
        </div>

        <div className="nao-status-row">
          <span
            className={`nao-dot ${status?.duckdbExists ? 'is-online' : 'is-offline'}`}
            aria-hidden
          />
          <span className="muted">
            {status?.duckdbExists ? 'DuckDB pronto' : 'Sincronize os dados'}
          </span>
        </div>

        <div className="actions" style={{ marginTop: 8 }}>
          <button className="btn" disabled={busy} onClick={sync}>
            {busy ? 'Sincronizando…' : 'Sincronizar dados'}
          </button>
        </div>

        <h3 style={{ marginTop: 20, fontSize: 13 }}>Perguntas sugeridas</h3>
        <ul className="nao-prompts">
          {PROMPTS.map((q) => (
            <li key={q}>
              <button
                type="button"
                className="nao-prompt"
                disabled={busy}
                onClick={() => void ask(q)}
              >
                {q}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="nao-main native-chat">
        <div className="chat-thread">
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
      </div>
    </div>
  );
}
