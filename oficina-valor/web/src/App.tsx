import { useEffect, useMemo, useState } from 'react';
import {
  api,
  AuthError,
  brl,
  clearSession,
  getUser,
  onAuthChange,
  setSession,
  type User,
} from './lib/api';
import { NaoWorkspace } from './components/NaoWorkspace';
import { WizardGanhos } from './components/WizardGanhos';

type Tab =
  | 'diretoria'
  | 'projetos'
  | 'financas'
  | 'gates'
  | 'nao'
  | 'wizard'
  | 'auditoria'
  | 'import';

type Health = 'green' | 'yellow' | 'red';

const brlFmt = brl;

const NAV: { section: string; items: { id: Tab; label: string; icon: string }[] }[] =
  [
    {
      section: 'Planejamento',
      items: [
        { id: 'projetos', label: 'Board', icon: '▦' },
        { id: 'diretoria', label: 'Portfólio', icon: '◫' },
      ],
    },
    {
      section: 'Valor',
      items: [
        { id: 'wizard', label: 'Wizard ganhos', icon: '✦' },
        { id: 'financas', label: 'Homologação', icon: '☑' },
        { id: 'gates', label: 'Gates', icon: '⇢' },
        { id: 'nao', label: 'Insights', icon: '◎' },
      ],
    },
    {
      section: 'Operação',
      items: [
        { id: 'auditoria', label: 'Auditoria', icon: '☰' },
        { id: 'import', label: 'Importações', icon: '⇪' },
      ],
    },
  ];

const TITLES: Record<Tab, string> = {
  projetos: 'Board',
  diretoria: 'Transformation status',
  financas: 'Homologação',
  gates: 'Gates',
  nao: 'Insights',
  wizard: 'Wizard de ganhos',
  auditoria: 'Auditoria',
  import: 'Importações',
};

const STATUS_LOZENGE: Record<string, string> = {
  conceito: 'default',
  execucao: 'in-progress',
  sustentacao: 'discovery',
  encerrado: 'done',
  hold: 'warning',
  morto: 'danger',
};

function healthFromBrr(brr: number | null | undefined): Health {
  if (brr == null) return 'yellow';
  if (brr >= 0.7) return 'green';
  if (brr >= 0.4) return 'yellow';
  return 'red';
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    conceito: 'To do',
    execucao: 'In progress',
    sustentacao: 'Sustentação',
    encerrado: 'Done',
    hold: 'Hold',
    morto: 'Kill',
  };
  return map[status] || status;
}

function projectKey(_nome: string, idx: number) {
  return `OV-${100 + idx}`;
}

export default function App() {
  const [user, setUser] = useState<User | null>(getUser());
  const [bootstrapping, setBootstrapping] = useState(!!getUser());
  const [tab, setTab] = useState<Tab>('projetos');
  const [error, setError] = useState('');
  const [projetos, setProjetos] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projeto, setProjeto] = useState<any | null>(null);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [portfolio, setPortfolio] = useState<any | null>(null);
  const [pendentes, setPendentes] = useState<any[]>([]);
  const [auditoria, setAuditoria] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [query, setQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState<'all' | Health>('all');

  const [beneficioId, setBeneficioId] = useState('');
  const [periodo, setPeriodo] = useState('2026-04-01');
  const [valor, setValor] = useState('10000');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    return onAuthChange(setUser);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getUser()) {
        setBootstrapping(false);
        return;
      }
      try {
        await api.ensureSession();
        if (!cancelled) setError('');
      } catch {
        clearSession();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshList() {
    const list = await api.projetos();
    setProjetos(list);
    if (!selectedId && list[0]) setSelectedId(list[0].id);
  }

  async function refreshSelected(id: string) {
    const [p, a] = await Promise.all([api.projeto(id), api.analytics(id)]);
    setProjeto(p);
    setAnalytics(a);
    const hard = p.businessCase?.beneficios?.find((b: any) => b.categoria === 'hard');
    if (hard) setBeneficioId(hard.id);
  }

  function handleApiError(e: unknown) {
    if (e instanceof AuthError) {
      setUser(null);
      setError('');
      return;
    }
    setError(e instanceof Error ? e.message : String(e));
  }

  useEffect(() => {
    if (!user || bootstrapping) return;
    setError('');
    refreshList().catch(handleApiError);
  }, [user, bootstrapping]);

  useEffect(() => {
    if (!user || !selectedId || bootstrapping) return;
    refreshSelected(selectedId).catch(handleApiError);
  }, [user, selectedId, bootstrapping]);

  useEffect(() => {
    if (!user || bootstrapping) return;
    if (tab === 'diretoria' || tab === 'projetos') {
      api.portfolio().then(setPortfolio).catch(handleApiError);
    }
    if (tab === 'financas') {
      api.pendentes().then(setPendentes).catch(handleApiError);
    }
    if (tab === 'auditoria') {
      api.auditoria().then(setAuditoria).catch(handleApiError);
    }
  }, [tab, user, bootstrapping]);

  const analyticsById = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of portfolio?.porProjeto || []) map.set(p.projetoId, p);
    return map;
  }, [portfolio]);

  const enriched = useMemo(() => {
    return projetos.map((p, idx) => {
      const a = analyticsById.get(p.id);
      const brr = a?.brr ?? null;
      const health = healthFromBrr(brr);
      return {
        ...p,
        key: projectKey(p.nome, idx),
        analytics: a,
        brr,
        health,
        prometido: a?.prometido ?? Number(p.investimentoAprovado || 0),
        realizado: a?.realizado ?? 0,
      };
    });
  }, [projetos, analyticsById]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter((p) => {
      if (healthFilter !== 'all' && p.health !== healthFilter) return false;
      if (!q) return true;
      return (
        p.nome.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q) ||
        (p.area?.nome || '').toLowerCase().includes(q)
      );
    });
  }, [enriched, query, healthFilter]);

  const boardCols = useMemo(() => {
    return {
      green: filtered.filter((p) => p.health === 'green'),
      yellow: filtered.filter((p) => p.health === 'yellow'),
      red: filtered.filter((p) => p.health === 'red'),
    };
  }, [filtered]);

  const healthCounts = useMemo(() => {
    const c = { green: 0, yellow: 0, red: 0 };
    for (const p of enriched) c[p.health as Health] += 1;
    return c;
  }, [enriched]);

  async function entrar() {
    setBusy(true);
    setError('');
    try {
      const res = await api.login('gerente@oficina.local');
      setSession(res.accessToken, res.user);
      setUser(res.user);
      setTab('projetos');
    } catch (e: any) {
      handleApiError(e);
    } finally {
      setBusy(false);
    }
  }

  async function registrarMedicao() {
    if (!beneficioId || !file) {
      setError('Selecione benefício e anexe evidência');
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const med: any = await api.criarMedicao(beneficioId, {
        periodoReferencia: periodo,
        valorRealizado: Number(valor),
      });
      await api.uploadEvidencia(med.id, file);
      await api.submeter(med.id);
      setMsg('Medição enviada — homologue na seção Homologação');
      if (selectedId) await refreshSelected(selectedId);
      setPortfolio(await api.portfolio());
    } catch (e: any) {
      handleApiError(e);
    } finally {
      setBusy(false);
    }
  }

  if (bootstrapping) {
    return (
      <div className="login">
        <div className="login-card">
          <div className="logo-mark">
            <span className="mark" aria-hidden />
            <strong>Oficina de Valor</strong>
          </div>
          <p className="muted">Restaurando sessão…</p>
        </div>
      </div>
    );
  }

  const initials = (user?.nome || 'GP')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (!user) {
    return (
      <div className="login">
        <div className="login-card">
          <div className="logo-mark">
            <span className="mark" aria-hidden />
            <strong>Oficina de Valor</strong>
          </div>
          <h1>Gerencie o portfólio pelo valor</h1>
          <p className="muted">
            Planeje, meça e homologe benefícios com a clareza de um board ágil —
            inspirado no Atlassian Design System.
          </p>
          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={busy} onClick={entrar} style={{ width: '100%' }}>
            Entrar como Gerente de Portfólio
          </button>
        </div>
      </div>
    );
  }

  const prometido = portfolio?.prometido ?? 0;
  const realizado = portfolio?.realizado ?? 0;
  const pctDone = prometido > 0 ? Math.min(100, (realizado / prometido) * 100) : 0;
  const totalProjects = enriched.length || 1;
  const donutStyle = {
    background: `conic-gradient(
      #22a06b 0 ${((healthCounts.green / totalProjects) * 100).toFixed(1)}%,
      #f5cd47 ${((healthCounts.green / totalProjects) * 100).toFixed(1)}% ${(((healthCounts.green + healthCounts.yellow) / totalProjects) * 100).toFixed(1)}%,
      #e34935 ${(((healthCounts.green + healthCounts.yellow) / totalProjects) * 100).toFixed(1)}% 100%
    )`,
  };

  return (
    <div className="app-layout">
      <aside className="side-nav">
        <div className="brand">
          <span className="mark" aria-hidden />
          <div>
            <strong>Oficina de Valor</strong>
            <span>Software project · VMO</span>
          </div>
        </div>
        {NAV.map((group) => (
          <div key={group.section}>
            <div className="nav-section">{group.section}</div>
            {group.items.map((t) => (
              <button
                key={t.id}
                className={`nav-item ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <span className="nav-icon" aria-hidden>
                  {t.icon}
                </span>
                {t.label}
              </button>
            ))}
          </div>
        ))}
        <div className="spacer" />
        <div className="user-chip">
          <div className="avatar">{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{user.nome}</div>
            <div className="muted" style={{ fontSize: 11 }}>
              Gerente de Portfólio
            </div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="top-bar">
          <div>
            <div className="breadcrumb">
              Projects / <strong>Manufatura</strong>
            </div>
            <h1>{TITLES[tab]}</h1>
          </div>
          <div className="top-actions">
            {(tab === 'projetos' || tab === 'wizard') && (
              <button
                className="btn"
                onClick={() => {
                  setTab('wizard');
                  setMsg('Wizard BPMN · baseline ou realização');
                }}
              >
                + Create
              </button>
            )}
            <button
              className="btn secondary"
              onClick={() => {
                clearSession();
                setUser(null);
              }}
            >
              Sair
            </button>
          </div>
        </header>

        <div
          className={`content ${
            tab === 'projetos' || tab === 'diretoria' || tab === 'wizard' || tab === 'nao'
              ? 'wide'
              : ''
          }`}
        >
          {error && <p className="error">{error}</p>}
          {msg && <p className="ok">{msg}</p>}

          {tab === 'wizard' && (
            <WizardGanhos
              projetos={projetos}
              selectedId={selectedId}
              onSelectProjeto={setSelectedId}
              onDone={() => {
                void refreshList();
                if (selectedId) void refreshSelected(selectedId);
                void api.portfolio().then(setPortfolio);
              }}
              onError={setError}
              onMessage={(m) => {
                setMsg(m);
                setError('');
              }}
            />
          )}

          {tab === 'diretoria' && (
            <>
              {!portfolio ? (
                <section className="panel">
                  <p className="muted">Carregando portfólio…</p>
                </section>
              ) : (
                <>
                  <div className="metric-row">
                    <div className="metric-card">
                      <div className="metric-icon green" aria-hidden>
                        ✓
                      </div>
                      <div>
                        <div className="value tone-green">{brlFmt(portfolio.realizado)}</div>
                        <div className="label">Valor homologado</div>
                      </div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-icon blue" aria-hidden>
                        ◆
                      </div>
                      <div>
                        <div className="value tone-blue">{portfolio.roiLabel}</div>
                        <div className="label">ROI do portfólio</div>
                      </div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-icon orange" aria-hidden>
                        !
                      </div>
                      <div>
                        <div className="value tone-orange">{portfolio.projetosEmRisco}</div>
                        <div className="label">Em risco (BRR &lt; 70%)</div>
                      </div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-icon purple" aria-hidden>
                        ≡
                      </div>
                      <div>
                        <div className="value tone-purple">{brlFmt(portfolio.prometido)}</div>
                        <div className="label">Baseline prometida</div>
                      </div>
                    </div>
                  </div>

                  <div className="dash-grid">
                    <section className="panel">
                      <div className="panel-head">
                        <h2>Status overview</h2>
                        <span className="meta">Portfólio atual</span>
                      </div>
                      <div className="status-overview">
                        <div className="donut" style={donutStyle}>
                          <div className="donut-center">
                            <strong>{pctDone.toFixed(0)}%</strong>
                            <span>capturado</span>
                          </div>
                        </div>
                        <ul className="status-legend">
                          <li>
                            <span className="swatch" style={{ background: '#22a06b' }} />
                            On track
                            <span className="count">{healthCounts.green}</span>
                          </li>
                          <li>
                            <span className="swatch" style={{ background: '#f5cd47' }} />
                            At risk
                            <span className="count">{healthCounts.yellow}</span>
                          </li>
                          <li>
                            <span className="swatch" style={{ background: '#e34935' }} />
                            Delayed
                            <span className="count">{healthCounts.red}</span>
                          </li>
                        </ul>
                      </div>
                      <div className="progress-block" style={{ marginTop: 20 }}>
                        <div className="progress-label">
                          <span>
                            Captura de valor ·{' '}
                            <strong>
                              {brlFmt(realizado)} de {brlFmt(prometido)}
                            </strong>
                          </span>
                          <strong>{pctDone.toFixed(0)}% done</strong>
                        </div>
                        <div className="progress-track">
                          <i className="done" style={{ width: `${pctDone}%` }} />
                          <i className="todo" style={{ width: `${100 - pctDone}%` }} />
                        </div>
                        <div className="progress-legend">
                          <span className="done">{pctDone.toFixed(0)}% done</span>
                          <span className="todo">{(100 - pctDone).toFixed(0)}% remaining</span>
                        </div>
                      </div>
                    </section>

                    <section className="panel">
                      <div className="panel-head">
                        <h2>Curva S</h2>
                        <span className="meta">Planejado vs realizado</span>
                      </div>
                      <CurvaS data={portfolio.curvaS || []} />
                      <div className="actions">
                        <button className="btn secondary" onClick={() => api.exportGanhos()}>
                          Exportar ganhos
                        </button>
                        <button className="btn secondary" onClick={() => setTab('nao')}>
                          Abrir Insights
                        </button>
                      </div>
                    </section>
                  </div>

                  <section className="panel">
                    <div className="panel-head">
                      <h2>Health por projeto</h2>
                      <span className="meta">{enriched.length} programas</span>
                    </div>
                    <div className="rag-table-wrap">
                      <table className="rag-table">
                        <thead>
                          <tr>
                            <th>Programa</th>
                            <th>Prometido</th>
                            <th>Realizado</th>
                            <th>BRR</th>
                            <th>ROI</th>
                            <th>Overall</th>
                            <th>Valor</th>
                            <th>Custo</th>
                            <th>Gate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {enriched.map((p) => {
                            const brrPct =
                              p.brr == null ? null : Math.round(p.brr * 100);
                            const custoHealth: Health =
                              p.analytics?.custoRealizado > p.prometido
                                ? 'red'
                                : p.analytics?.custoRealizado > p.prometido * 0.7
                                  ? 'yellow'
                                  : 'green';
                            const valorHealth = p.health;
                            const gateHealth: Health =
                              p.status === 'hold' || p.status === 'morto'
                                ? 'red'
                                : p.status === 'execucao'
                                  ? 'green'
                                  : 'yellow';
                            return (
                              <tr
                                key={p.id}
                                className={selectedId === p.id ? 'is-selected' : ''}
                                onClick={() => {
                                  setSelectedId(p.id);
                                  setTab('projetos');
                                }}
                              >
                                <td>
                                  <strong>{p.nome}</strong>
                                  <div className="muted" style={{ fontSize: 12 }}>
                                    {p.key} · {p.area?.nome}
                                  </div>
                                </td>
                                <td>{brlFmt(p.prometido)}</td>
                                <td>{brlFmt(p.realizado)}</td>
                                <td>{brrPct == null ? '—' : `${brrPct}%`}</td>
                                <td>{p.analytics?.roiLabel ?? '—'}</td>
                                <td>
                                  <span className={`rag-dot ${p.health}`} title="Overall" />
                                </td>
                                <td>
                                  <span className={`rag-dot ${valorHealth}`} title="Valor" />
                                </td>
                                <td>
                                  <span className={`rag-dot ${custoHealth}`} title="Custo" />
                                </td>
                                <td>
                                  <span className={`rag-dot ${gateHealth}`} title="Gate" />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="rag-legend">
                      <span>
                        <i className="rag-dot green" /> On track
                      </span>
                      <span>
                        <i className="rag-dot yellow" /> At risk
                      </span>
                      <span>
                        <i className="rag-dot red" /> Delayed
                      </span>
                      <span>
                        <i className="rag-dot blue" /> Complete
                      </span>
                    </div>
                  </section>
                </>
              )}
            </>
          )}

          {tab === 'projetos' && (
            <>
              <div className="toolbar">
                <label className="search-field">
                  <span aria-hidden>⌕</span>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search"
                  />
                </label>
                <div className="avatar-stack" title="Time VMO">
                  <div className="avatar sm">GP</div>
                  <div className="avatar sm tone-green">FM</div>
                  <div className="avatar sm tone-orange">PM</div>
                  <div className="avatar sm tone-purple">+2</div>
                </div>
                <button
                  className={`chip-btn ${healthFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setHealthFilter('all')}
                >
                  All
                </button>
                <button
                  className={`chip-btn ${healthFilter === 'green' ? 'active' : ''}`}
                  onClick={() => setHealthFilter('green')}
                >
                  On track
                </button>
                <button
                  className={`chip-btn ${healthFilter === 'yellow' ? 'active' : ''}`}
                  onClick={() => setHealthFilter('yellow')}
                >
                  At risk
                </button>
                <button
                  className={`chip-btn ${healthFilter === 'red' ? 'active' : ''}`}
                  onClick={() => setHealthFilter('red')}
                >
                  Delayed
                </button>
                <button className="chip-btn" onClick={() => setTab('diretoria')}>
                  Insights
                </button>
              </div>

              <div className="split">
                <div className="board">
                  <BoardColumn
                    title="On track"
                    count={boardCols.green.length}
                    items={boardCols.green}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                  <BoardColumn
                    title="At risk"
                    count={boardCols.yellow.length}
                    items={boardCols.yellow}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                  <BoardColumn
                    title="Delayed"
                    count={boardCols.red.length}
                    items={boardCols.red}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                </div>

                <section className="panel detail-panel">
                  {!projeto || !analytics ? (
                    <p className="muted">Selecione um card no board.</p>
                  ) : (
                    <>
                      <div className="issue-hero">
                        <span className={`badge ${STATUS_LOZENGE[projeto.status] || 'info'}`}>
                          {statusLabel(projeto.status)}
                        </span>
                        <h2>{projeto.nome}</h2>
                        <p className="muted" style={{ margin: '6px 0 0' }}>
                          {projeto.area?.nome} · investimento{' '}
                          {brlFmt(projeto.investimentoAprovado)}
                        </p>
                      </div>

                      <div className="grid">
                        <div className="metric">
                          <div className="label">ROI</div>
                          <div className="value">{analytics.roiLabel}</div>
                        </div>
                        <div className="metric">
                          <div className="label">Realizado</div>
                          <div className="value">{brlFmt(analytics.realizado)}</div>
                        </div>
                        <div className="metric">
                          <div className="label">Prometido</div>
                          <div className="value">{brlFmt(analytics.prometido)}</div>
                        </div>
                        <div className="metric">
                          <div className="label">BRR</div>
                          <div className="value">
                            {analytics.brr == null
                              ? '—'
                              : `${(analytics.brr * 100).toFixed(0)}%`}
                          </div>
                        </div>
                      </div>

                      <div className="progress-block">
                        <div className="progress-label">
                          <span>Benefit realization</span>
                          <strong>
                            {analytics.brr == null
                              ? '—'
                              : `${(analytics.brr * 100).toFixed(0)}%`}
                          </strong>
                        </div>
                        <div className="progress-track">
                          <i
                            className="done"
                            style={{
                              width: `${Math.min(100, (analytics.brr || 0) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      <CurvaS data={analytics.curvaS || []} />

                      <h3>Registrar medição</h3>
                      <p className="muted">Valor + evidência + envio para homologação.</p>
                      <div className="stack">
                        <label className="field">
                          Benefício
                          <select
                            value={beneficioId}
                            onChange={(e) => setBeneficioId(e.target.value)}
                          >
                            {(projeto.businessCase?.beneficios || []).map((b: any) => (
                              <option key={b.id} value={b.id}>
                                {b.nome} ({b.categoria})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          Período (AAAA-MM-DD)
                          <input
                            value={periodo}
                            onChange={(e) => setPeriodo(e.target.value)}
                          />
                        </label>
                        <label className="field">
                          Valor realizado (R$)
                          <input
                            value={valor}
                            onChange={(e) => setValor(e.target.value)}
                            type="number"
                          />
                        </label>
                        <label className="field">
                          Evidência
                          <input
                            type="file"
                            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                          />
                        </label>
                        <button className="btn" disabled={busy} onClick={registrarMedicao}>
                          Registrar e enviar
                        </button>
                      </div>
                    </>
                  )}
                </section>
              </div>
            </>
          )}

          {tab === 'financas' && (
            <section className="panel stack">
              <div className="panel-head">
                <h2>Fila de homologação</h2>
                <span className="badge in-progress">{pendentes.length} pending</span>
              </div>
              <div className="list">
                {pendentes.map((m) => (
                  <div key={m.id} className="row" style={{ cursor: 'default' }}>
                    <div className="row-main">
                      <div className="avatar sm tone-orange">HV</div>
                      <div>
                        <strong>{m.beneficio?.businessCase?.projeto?.nome}</strong>
                        <div className="muted">
                          {m.beneficio?.nome} ·{' '}
                          {m.periodoReferencia?.slice?.(0, 10) || m.periodoReferencia} ·{' '}
                          {brlFmt(m.valorRealizado)}
                        </div>
                        <div className="issue-labels" style={{ marginTop: 6 }}>
                          <span className="label-pill hard">Valor</span>
                          <span className="badge warning">In review</span>
                          <span className="muted" style={{ fontSize: 12 }}>
                            evidências: {m.evidencias?.length ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="actions" style={{ marginTop: 0 }}>
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await api.validar(m.id, 'aprovada', 'OK');
                            setPendentes(await api.pendentes());
                            setMsg('Medição homologada');
                          } catch (e: any) {
                            setError(e.message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Homologar
                      </button>
                      <button
                        className="btn danger"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await api.validar(m.id, 'rejeitada', 'Revisar evidência');
                            setPendentes(await api.pendentes());
                          } catch (e: any) {
                            setError(e.message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Rejeitar
                      </button>
                    </div>
                  </div>
                ))}
                {!pendentes.length && (
                  <div className="empty-state">
                    <strong>Nenhuma medição pendente</strong>
                    <span>Registre valor no Board e envie para esta fila.</span>
                  </div>
                )}
              </div>

              {selectedId && (
                <div className="stack">
                  <h3>Custo realizado</h3>
                  <button
                    className="btn secondary"
                    onClick={async () => {
                      try {
                        await api.custo(selectedId, {
                          periodoReferencia: '2026-04-01',
                          valor: 5000,
                        });
                        setMsg('Custo lançado no projeto selecionado');
                        await refreshSelected(selectedId);
                      } catch (e: any) {
                        setError(e.message);
                      }
                    }}
                  >
                    Lançar R$ 5.000 no projeto selecionado
                  </button>
                </div>
              )}
            </section>
          )}

          {tab === 'gates' && projeto && (
            <section className="panel stack">
              <div className="panel-head">
                <h2>Sprint · {projeto.nome}</h2>
                <span
                  className={`badge ${projeto.premissasOkFinancas ? 'active' : 'warning'}`}
                >
                  {projeto.premissasOkFinancas ? 'Active' : 'Premissas pendentes'}
                </span>
              </div>
              <p className="muted">
                Decisão de gate com rastreio de status — Go / Hold / Kill.
              </p>
              {!projeto.premissasOkFinancas && (
                <button
                  className="btn"
                  onClick={async () => {
                    await api.premissas(projeto.id, true, 'Premissas OK');
                    await refreshSelected(projeto.id);
                  }}
                >
                  Marcar premissas OK
                </button>
              )}
              <div className="actions">
                {(['G1', 'G2', 'G3', 'G4', 'G5'] as const).map((g) => (
                  <button
                    key={g}
                    className="btn secondary"
                    onClick={async () => {
                      try {
                        await api.gate(projeto.id, {
                          gate: g,
                          decisao: 'go',
                          comentario: `${g} go`,
                        });
                        await refreshSelected(projeto.id);
                        setMsg(`Gate ${g} registrado`);
                      } catch (e: any) {
                        setError(e.message);
                      }
                    }}
                  >
                    {g} Go
                  </button>
                ))}
                <button
                  className="btn danger"
                  onClick={async () => {
                    try {
                      await api.gate(projeto.id, { gate: 'G3', decisao: 'kill' });
                      await refreshList();
                      await refreshSelected(projeto.id);
                    } catch (e: any) {
                      setError(e.message);
                    }
                  }}
                >
                  Kill
                </button>
                <button
                  className="btn secondary"
                  onClick={async () => {
                    try {
                      await api.gate(projeto.id, { gate: 'G3', decisao: 'hold' });
                      await refreshSelected(projeto.id);
                    } catch (e: any) {
                      setError(e.message);
                    }
                  }}
                >
                  Hold
                </button>
              </div>
              <div className="list">
                {(projeto.gates || []).map((g: any) => (
                  <div key={g.id} className="row" style={{ cursor: 'default' }}>
                    <div className="row-main">
                      <span className="issue-type story">G</span>
                      <div>
                        <strong>
                          {g.gate} · {g.decisao}
                        </strong>
                        <div className="muted">
                          {new Date(g.decididaEm).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`badge ${
                        g.decisao === 'go'
                          ? 'done'
                          : g.decisao === 'kill'
                            ? 'danger'
                            : 'warning'
                      }`}
                    >
                      {g.decisao}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === 'gates' && !projeto && (
            <section className="panel">
              <div className="empty-state">
                <strong>Selecione um projeto no Board</strong>
                <span>Os gates são decididos no contexto do programa ativo.</span>
              </div>
            </section>
          )}

          {tab === 'nao' && (
            <section className="panel nao-panel">
              <NaoWorkspace
                onMessage={(m) => {
                  setMsg(m);
                  setError('');
                }}
                onError={setError}
              />
            </section>
          )}

          {tab === 'auditoria' && (
            <section className="panel">
              <div className="panel-head">
                <h2>Histórico de alterações</h2>
                <span className="meta">{auditoria.length} eventos</span>
              </div>
              <div className="list">
                {auditoria.slice(0, 50).map((a) => (
                  <div key={a.id} className="row" style={{ cursor: 'default' }}>
                    <div className="row-main">
                      <div className="avatar sm tone-teal">
                        {(a.usuario?.nome || 'S')
                          .split(' ')
                          .map((p: string) => p[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div>
                        <strong>
                          {a.entidade} · {a.acao}
                        </strong>
                        <div className="muted">
                          {a.usuario?.nome || 'sistema'} ·{' '}
                          {new Date(a.createdAt).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                    <span className="badge default">{a.acao}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === 'import' && (
            <section className="panel stack">
              <div className="panel-head">
                <h2>Importar dados</h2>
                <span className="meta">CSV · ERP / legado</span>
              </div>
              <label className="field">
                Planilha legada (CSV)
                <input
                  type="file"
                  accept=".csv"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const res: any = await api.importLegado(f);
                      setMsg(`Importados ${res.importados} projetos`);
                      await refreshList();
                    } catch (err: any) {
                      setError(err.message);
                    }
                  }}
                />
              </label>
              <label className="field">
                Custos ERP (CSV)
                <input
                  type="file"
                  accept=".csv"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const res: any = await api.importCustos(f);
                      setMsg(`Custos importados: ${res.importados}`);
                    } catch (err: any) {
                      setError(err.message);
                    }
                  }}
                />
              </label>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function BoardColumn({
  title,
  count,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  count: number;
  items: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="board-col">
      <div className="board-col-head">
        {title}
        <span className="count">{count}</span>
      </div>
      {items.map((p) => {
        const pct =
          p.prometido > 0 ? Math.min(100, (p.realizado / p.prometido) * 100) : 0;
        const barTone =
          p.health === 'green' ? 'ok' : p.health === 'yellow' ? 'warn' : 'bad';
        return (
          <button
            key={p.id}
            className={`issue-card ${selectedId === p.id ? 'is-selected' : ''}`}
            onClick={() => onSelect(p.id)}
          >
            <div className="issue-labels">
              <span className="label-pill hard">{p.area?.nome || 'Área'}</span>
              <span className={`badge ${STATUS_LOZENGE[p.status] || 'info'}`}>
                {statusLabel(p.status)}
              </span>
            </div>
            <p className="issue-title">{p.nome}</p>
            <div className={`mini-bar ${barTone}`}>
              <i style={{ width: `${pct}%` }} />
            </div>
            <div className="issue-meta">
              <span className="issue-key">
                <span className="issue-type story">S</span>
                {p.key}
              </span>
              <span className="muted" style={{ fontSize: 12 }}>
                {brlFmt(p.realizado)}
              </span>
            </div>
          </button>
        );
      })}
      {!items.length && <p className="muted" style={{ padding: 8 }}>Nenhum card</p>}
    </div>
  );
}

function CurvaS({
  data,
}: {
  data: {
    periodo: string;
    planejadoAcumulado: number;
    realizadoAcumulado: number;
  }[];
}) {
  const max = Math.max(
    1,
    ...data.map((d) => Math.max(d.planejadoAcumulado, d.realizadoAcumulado)),
  );
  if (!data.length) return <p className="muted">Sem série ainda.</p>;
  return (
    <div className="chart">
      {data.map((d) => (
        <div className="bar-row" key={d.periodo}>
          <span>{d.periodo}</span>
          <div className="bar" title={`Planejado ${brlFmt(d.planejadoAcumulado)}`}>
            <i style={{ width: `${(d.planejadoAcumulado / max) * 100}%` }} />
          </div>
          <div
            className="bar actual"
            title={`Realizado ${brlFmt(d.realizadoAcumulado)}`}
          >
            <i style={{ width: `${(d.realizadoAcumulado / max) * 100}%` }} />
          </div>
        </div>
      ))}
      <p className="muted">Azul: planejado · Verde: realizado</p>
    </div>
  );
}
