import { useEffect, useState } from 'react';
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

type Tab =
  | 'diretoria'
  | 'projetos'
  | 'financas'
  | 'gates'
  | 'nao'
  | 'auditoria'
  | 'import';

const brlFmt = brl;

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'projetos', label: 'Projetos', icon: '▤' },
  { id: 'diretoria', label: 'Portfólio', icon: '◫' },
  { id: 'financas', label: 'Homologação', icon: '☑' },
  { id: 'gates', label: 'Gates', icon: '⇢' },
  { id: 'nao', label: 'Analytics', icon: '◎' },
  { id: 'auditoria', label: 'Auditoria', icon: '☰' },
  { id: 'import', label: 'Importações', icon: '⇪' },
];

const TITLES: Record<Tab, string> = {
  projetos: 'Projetos',
  diretoria: 'Visão do portfólio',
  financas: 'Homologação de valor',
  gates: 'Gates de decisão',
  nao: 'Analytics Nao',
  auditoria: 'Trilha de auditoria',
  import: 'Importações',
};

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

  const [beneficioId, setBeneficioId] = useState('');
  const [periodo, setPeriodo] = useState('2026-04-01');
  const [valor, setValor] = useState('10000');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    return onAuthChange(setUser);
  }, []);

  // Renova JWT ao abrir (evita "Token inválido" após reset do banco)
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
    if (tab === 'diretoria') {
      api.portfolio().then(setPortfolio).catch(handleApiError);
    }
    if (tab === 'financas') {
      api.pendentes().then(setPendentes).catch(handleApiError);
    }
    if (tab === 'auditoria') {
      api.auditoria().then(setAuditoria).catch(handleApiError);
    }
  }, [tab, user, bootstrapping]);

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

  return (
    <div className="app-layout">
      <aside className="side-nav">
        <div className="brand">
          <span className="mark" aria-hidden />
          <div>
            <strong>Oficina de Valor</strong>
            <span>Portfólio · VMO</span>
          </div>
        </div>
        {TABS.map((t) => (
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
            <div className="breadcrumb">Espaço · Manufatura</div>
            <h1>{TITLES[tab]}</h1>
          </div>
          <button
            className="btn secondary"
            onClick={() => {
              clearSession();
              setUser(null);
            }}
          >
            Sair
          </button>
        </header>

        <div className="content">
          {error && <p className="error">{error}</p>}
          {msg && <p className="ok">{msg}</p>}

          {tab === 'diretoria' && (
            <section className="panel">
              <h2>Sumário executivo</h2>
              {!portfolio ? (
                <p className="muted">Carregando…</p>
              ) : (
                <>
                  <div className="grid">
                    <div className="metric">
                      <div className="label">Prometido (baseline)</div>
                      <div className="value">{brlFmt(portfolio.prometido)}</div>
                    </div>
                    <div className="metric">
                      <div className="label">Realizado validado</div>
                      <div className="value">{brlFmt(portfolio.realizado)}</div>
                    </div>
                    <div className="metric">
                      <div className="label">ROI portfólio</div>
                      <div className="value">{portfolio.roiLabel}</div>
                    </div>
                    <div className="metric">
                      <div className="label">Em risco (BRR&lt;70%)</div>
                      <div className="value">{portfolio.projetosEmRisco}</div>
                    </div>
                  </div>
                  <h3>Curva S consolidada</h3>
                  <CurvaS data={portfolio.curvaS || []} />
                  <div className="actions">
                    <button className="btn secondary" onClick={() => api.exportGanhos()}>
                      Exportar ganhos (Excel)
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {tab === 'projetos' && (
            <section className="panel stack">
              <h2>Backlog de projetos</h2>
              <div className="list">
                {projetos.map((p) => (
                  <button
                    key={p.id}
                    className="row"
                    onClick={() => setSelectedId(p.id)}
                    style={
                      selectedId === p.id
                        ? { borderColor: '#adcbfb', background: '#e9f2fe' }
                        : undefined
                    }
                  >
                    <div>
                      <strong>{p.nome}</strong>
                      <div className="muted">
                        {p.area?.nome} · <span className="badge">{p.status}</span>
                      </div>
                    </div>
                    <div className="muted">{brlFmt(p.investimentoAprovado)}</div>
                  </button>
                ))}
              </div>

              {projeto && analytics && (
                <>
                  <h3>{projeto.nome}</h3>
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
                  <CurvaS data={analytics.curvaS || []} />

                  <div className="stack" style={{ marginTop: 8 }}>
                    <h3>Registrar medição</h3>
                    <p className="muted">Valor + evidência + envio para homologação.</p>
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
                      <input value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
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
          )}

          {tab === 'financas' && (
            <section className="panel stack">
              <h2>Fila de homologação</h2>
              <div className="list">
                {pendentes.map((m) => (
                  <div key={m.id} className="row" style={{ cursor: 'default' }}>
                    <div>
                      <strong>{m.beneficio?.businessCase?.projeto?.nome}</strong>
                      <div className="muted">
                        {m.beneficio?.nome} ·{' '}
                        {m.periodoReferencia?.slice?.(0, 10) || m.periodoReferencia} ·{' '}
                        {brlFmt(m.valorRealizado)}
                      </div>
                      <div className="muted">
                        evidências: {m.evidencias?.length ?? 0}
                      </div>
                    </div>
                    <div className="actions">
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
                  <p className="muted">Nenhuma medição pendente.</p>
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
              <h2>Gates — {projeto.nome}</h2>
              <p className="muted">
                Premissas:{' '}
                <span className={`badge ${projeto.premissasOkFinancas ? 'success' : 'warning'}`}>
                  {projeto.premissasOkFinancas ? 'OK' : 'pendente'}
                </span>
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
                    <div>
                      <strong>
                        {g.gate} · {g.decisao}
                      </strong>
                      <div className="muted">
                        {new Date(g.decididaEm).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === 'nao' && (
            <section className="panel stack">
              <h2>Analytics conversacional</h2>
              <div className="actions">
                <button
                  className="btn"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const res = await api.syncNao();
                      setMsg(
                        `Sync Nao: mode=${res.mode} arquivos=${res.manifesto?.files?.length ?? Object.keys(res.files || {}).length}`,
                      );
                    } catch (e: any) {
                      setError(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Sincronizar Nao
                </button>
              </div>
              <iframe className="nao-frame" title="Nao" src={api.naoUrl} />
            </section>
          )}

          {tab === 'auditoria' && (
            <section className="panel">
              <h2>Histórico de alterações</h2>
              <div className="list">
                {auditoria.slice(0, 50).map((a) => (
                  <div key={a.id} className="row" style={{ cursor: 'default' }}>
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
                ))}
              </div>
            </section>
          )}

          {tab === 'import' && (
            <section className="panel stack">
              <h2>Importar dados</h2>
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
