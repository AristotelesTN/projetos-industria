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
import { AnalyticsBoard } from './components/AnalyticsBoard';
import { AgentsWorkspace } from './components/AgentsWorkspace';

type Tab =
  | 'diretoria'
  | 'projetos'
  | 'nao'
  | 'wizard'
  | 'agents'
  | 'auditoria'
  | 'import';

type Health = 'green' | 'yellow' | 'red';

const brlFmt = brl;

const NAV: { section: string; items: { id: Tab; label: string; icon: string }[] }[] =
  [
    {
      section: 'Planejamento',
      items: [
        { id: 'projetos', label: 'Analytics', icon: '▦' },
        { id: 'diretoria', label: 'Portfólio', icon: '◫' },
      ],
    },
    {
      section: 'Valor',
      items: [
        { id: 'agents', label: 'Agents', icon: '◉' },
        { id: 'wizard', label: 'Wizard ganhos', icon: '✦' },
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
  projetos: 'Analytics',
  diretoria: 'Transformation status',
  nao: 'Insights',
  wizard: 'Wizard de ganhos',
  agents: 'Agents',
  auditoria: 'Auditoria',
  import: 'Importações',
};

function healthFromBrr(brr: number | null | undefined): Health {
  if (brr == null) return 'yellow';
  if (brr >= 0.7) return 'green';
  if (brr >= 0.4) return 'yellow';
  return 'red';
}

export default function App() {
  const [user, setUser] = useState<User | null>(getUser());
  const [bootstrapping, setBootstrapping] = useState(!!getUser());
  const [tab, setTab] = useState<Tab>('projetos');
  const [error, setError] = useState('');
  const [projetos, setProjetos] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<any | null>(null);
  const [auditoria, setAuditoria] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [agentsPending, setAgentsPending] = useState(0);
  const [insightsPrompt, setInsightsPrompt] = useState<string | null>(null);

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
    if (!user || bootstrapping) return;
    if (tab === 'diretoria' || tab === 'projetos') {
      api.portfolio().then(setPortfolio).catch(handleApiError);
    }
    if (tab === 'auditoria') {
      api.auditoria().then(setAuditoria).catch(handleApiError);
    }
    if (tab === 'projetos' || tab === 'agents') {
      api
        .agentsOverview()
        .then((o) => setAgentsPending(o?.kpis?.awaiting ?? 0))
        .catch(() => undefined);
    }
  }, [tab, user, bootstrapping]);

  const analyticsById = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of portfolio?.porProjeto || []) map.set(p.projetoId, p);
    return map;
  }, [portfolio]);

  const enrichedPortfolio = useMemo(() => {
    if (!portfolio) return null;
    const areaById = new Map(projetos.map((p) => [p.id, p.area?.nome || 'Área']));
    return {
      ...portfolio,
      porProjeto: (portfolio.porProjeto || []).map((p: any) => ({
        ...p,
        area: areaById.get(p.projetoId) || 'Área',
        health: healthFromBrr(p.brr),
      })),
    };
  }, [portfolio, projetos]);

  const enriched = useMemo(() => {
    return projetos.map((p) => {
      const a = analyticsById.get(p.id);
      return {
        ...p,
        analytics: a,
        brr: a?.brr ?? null,
        health: healthFromBrr(a?.brr),
        prometido: a?.prometido ?? Number(p.investimentoAprovado || 0),
        realizado: a?.realizado ?? 0,
      };
    });
  }, [projetos, analyticsById]);

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
            Analytics de ganhos, ROI e prescrições — com Wizard BPMN e Insights
            nativos.
          </p>
          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={busy} onClick={entrar} style={{ width: '100%' }}>
            Entrar como Gerente de Portfólio
          </button>
        </div>
      </div>
    );
  }

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
            <button
              className="btn secondary agents-badge-btn"
              onClick={() => setTab('agents')}
            >
              <span className="orb sm blue" /> Agents
              {agentsPending > 0 && (
                <span className="badge-count">{agentsPending}</span>
              )}
            </button>
            {(tab === 'projetos' || tab === 'wizard' || tab === 'agents') && (
              <button
                className="btn"
                onClick={() => {
                  setTab('wizard');
                  setMsg('Wizard BPMN · baseline ou realização');
                }}
              >
                + Registrar ganho
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
            tab === 'projetos' ||
            tab === 'diretoria' ||
            tab === 'wizard' ||
            tab === 'nao' ||
            tab === 'agents'
              ? 'wide'
              : ''
          }`}
        >
          {error && <p className="error">{error}</p>}
          {msg && <p className="ok">{msg}</p>}

          {tab === 'projetos' && (
            <AnalyticsBoard
              portfolio={enrichedPortfolio}
              onOpenWizard={() => setTab('wizard')}
              onOpenInsights={() => setTab('nao')}
              onOpenAgents={() => setTab('agents')}
              agentsPending={agentsPending}
            />
          )}

          {tab === 'agents' && (
            <AgentsWorkspace
              onMessage={(m) => {
                setMsg(m);
                setError('');
              }}
              onError={setError}
              onNavigate={(nav) => {
                if (nav.projetoId) setSelectedId(String(nav.projetoId));
                if (nav.message) setMsg(String(nav.message));
                if (nav.prompt) setInsightsPrompt(String(nav.prompt));
                if (nav.tab === 'wizard') setTab('wizard');
                else if (nav.tab === 'nao') setTab('nao');
                else if (nav.tab === 'diretoria') setTab('diretoria');
                else setTab('agents');
                void api
                  .agentsOverview()
                  .then((o) => setAgentsPending(o?.kpis?.awaiting ?? 0))
                  .catch(() => undefined);
              }}
            />
          )}

          {tab === 'wizard' && (
            <WizardGanhos
              projetos={projetos}
              selectedId={selectedId}
              onSelectProjeto={setSelectedId}
              onDone={() => {
                void refreshList();
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
              {!enrichedPortfolio ? (
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
                        <div className="value tone-green">
                          {brlFmt(enrichedPortfolio.realizado)}
                        </div>
                        <div className="label">Valor homologado</div>
                      </div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-icon blue" aria-hidden>
                        ◆
                      </div>
                      <div>
                        <div className="value tone-blue">
                          {enrichedPortfolio.roiLabel}
                        </div>
                        <div className="label">ROI do portfólio</div>
                      </div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-icon orange" aria-hidden>
                        !
                      </div>
                      <div>
                        <div className="value tone-orange">
                          {enrichedPortfolio.projetosEmRisco}
                        </div>
                        <div className="label">Em risco (BRR &lt; 70%)</div>
                      </div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-icon purple" aria-hidden>
                        ≡
                      </div>
                      <div>
                        <div className="value tone-purple">
                          {brlFmt(enrichedPortfolio.prometido)}
                        </div>
                        <div className="label">Baseline prometida</div>
                      </div>
                    </div>
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
                            return (
                              <tr
                                key={p.id}
                                className={selectedId === p.id ? 'is-selected' : ''}
                                onClick={() => {
                                  setSelectedId(p.id);
                                  setTab('wizard');
                                }}
                              >
                                <td>
                                  <strong>{p.nome}</strong>
                                  <div className="muted" style={{ fontSize: 12 }}>
                                    {p.area?.nome}
                                  </div>
                                </td>
                                <td>{brlFmt(p.prometido)}</td>
                                <td>{brlFmt(p.realizado)}</td>
                                <td>{brrPct == null ? '—' : `${brrPct}%`}</td>
                                <td>{p.analytics?.roiLabel ?? '—'}</td>
                                <td>
                                  <span className={`rag-dot ${p.health}`} />
                                </td>
                                <td>
                                  <span className={`rag-dot ${p.health}`} />
                                </td>
                                <td>
                                  <span className={`rag-dot ${custoHealth}`} />
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
                    </div>
                  </section>
                </>
              )}
            </>
          )}

          {tab === 'nao' && (
            <section className="panel nao-panel">
              <NaoWorkspace
                initialPrompt={insightsPrompt}
                onInitialPromptConsumed={() => setInsightsPrompt(null)}
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
