import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { InsightsChart, type ChartSpec } from './InsightsChart';

const PROMPTS = [
  'Quais projetos estão com captura abaixo da baseline?',
  'Compare hard vs soft savings validados no portfólio',
  'Mostre a curva S planejado vs realizado',
  'Liste medições pendentes na fila de homologação',
  'Top 5 projetos por ROI',
  'Ganhos por categoria (hard, soft, avoidance)',
  'Gere um Story do portfólio com gráficos',
];

type StorySection = {
  id: string;
  heading: string;
  text: string;
  chart?: ChartSpec;
  rows?: Record<string, unknown>[];
};

type StoryDoc = {
  title: string;
  generatedAt?: string;
  sections: StorySection[];
};

type Msg = {
  role: 'user' | 'assistant';
  text: string;
  rows?: Record<string, unknown>[];
  chart?: ChartSpec;
  story?: StoryDoc;
  source?: string;
  hints?: string[];
};

function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]);
  return (
    <div className="chat-table-wrap">
      <table className="chat-table">
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {keys.map((k) => (
                <td key={k}>{String(row[k] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StoryPanel({
  story,
  onClose,
}: {
  story: StoryDoc;
  onClose: () => void;
}) {
  return (
    <aside className="insights-story" aria-label="Story">
      <div className="insights-story-head">
        <div>
          <p className="nao-onboard-kicker">Story mode</p>
          <h3>{story.title}</h3>
          {story.generatedAt && (
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
              Gerado em {new Date(story.generatedAt).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
        <button type="button" className="btn secondary" onClick={onClose}>
          Fechar
        </button>
      </div>
      <div className="insights-story-body">
        {story.sections.map((sec) => (
          <section key={sec.id} className="insights-story-section">
            <h4>{sec.heading}</h4>
            <p>{sec.text}</p>
            {sec.chart && <InsightsChart chart={sec.chart} />}
            {!!sec.rows?.length && <DataTable rows={sec.rows} />}
          </section>
        ))}
      </div>
    </aside>
  );
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
  const [busy, setBusy] = useState(false);
  const [storyBusy, setStoryBusy] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [story, setStory] = useState<StoryDoc | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const locked = busy || storyBusy;

  useEffect(() => {
    api
      .naoStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, story]);

  async function sync() {
    setBusy(true);
    try {
      const res = await api.syncNao();
      setStatus(await api.naoStatus());
      onMessage(
        res.ok
          ? `Snapshot sincronizado · ${res.written?.length ?? 0} CSVs`
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
      const next: Msg = {
        role: 'assistant',
        text: res.answer,
        rows: res.rows || [],
        chart: res.chart,
        story: res.story,
        source: res.source,
        hints: res.hints,
      };
      setMsgs((m) => [...m, next]);
      if (res.story) setStory(res.story);
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

  async function openStory() {
    setStoryBusy(true);
    try {
      const res = await api.storyNao();
      const doc = res.story as StoryDoc | undefined;
      setMsgs((m) => [
        ...m,
        {
          role: 'user',
          text: 'Gere um Story do portfólio com gráficos',
        },
        {
          role: 'assistant',
          text: res.answer || 'Story gerada.',
          story: doc,
          source: res.source,
        },
      ]);
      if (!doc?.sections?.length) {
        onError('A API não retornou seções de Story.');
        return;
      }
      setStory(doc);
      onMessage('Story do portfólio aberta');
    } catch (e: any) {
      onError(e.message || String(e));
    } finally {
      setStoryBusy(false);
    }
  }

  useEffect(() => {
    if (!initialPrompt) return;
    void ask(initialPrompt).finally(() => onInitialPromptConsumed?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  const duckReady = !!status?.duckdbExists;

  return (
    <div className={`nao-layout native insights-native${story ? ' has-story' : ''}`}>
      <aside className="nao-side">
        <div className="nao-side-head">
          <h2>Insights</h2>
        </div>

        <div className="nao-status-row">
          <span
            className={`nao-dot ${duckReady ? 'is-online' : 'is-offline'}`}
            aria-hidden
          />
          <span className="muted">
            {duckReady ? 'Dados sincronizados' : 'Sincronize o snapshot'}
          </span>
        </div>

        <div className="actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            disabled={locked}
            onClick={() => void sync()}
          >
            {busy ? 'Sincronizando…' : 'Atualizar snapshot'}
          </button>
          <button
            type="button"
            className="btn"
            disabled={locked}
            onClick={() => void openStory()}
          >
            {storyBusy ? 'Gerando…' : 'Gerar Story'}
          </button>
        </div>

        <h3 style={{ marginTop: 20, fontSize: 13 }}>Perguntas sugeridas</h3>
        <ul className="nao-prompts">
          {PROMPTS.map((q) => (
            <li key={q}>
              <button
                type="button"
                className="nao-prompt"
                disabled={locked}
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
              {m.chart && <InsightsChart chart={m.chart} />}
              {!!m.rows?.length && <DataTable rows={m.rows} />}
              {m.source && (
                <p className="insights-source muted">Fonte: {m.source}</p>
              )}
              {m.story && (
                <button
                  type="button"
                  className="btn secondary"
                  style={{ marginTop: 8 }}
                  onClick={() => setStory(m.story!)}
                >
                  Abrir Story
                </button>
              )}
              {!!m.hints?.length && (
                <div className="insights-hints">
                  {m.hints.map((h) => (
                    <button
                      key={h}
                      type="button"
                      className="nao-prompt"
                      disabled={locked}
                      onClick={() => void ask(h)}
                    >
                      {h}
                    </button>
                  ))}
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
            placeholder="Pergunte ou peça um Story…"
            disabled={locked}
          />
          <button
            className="btn"
            type="submit"
            disabled={locked || !input.trim()}
          >
            Enviar
          </button>
        </form>
      </div>

      {story && <StoryPanel story={story} onClose={() => setStory(null)} />}
    </div>
  );
}
