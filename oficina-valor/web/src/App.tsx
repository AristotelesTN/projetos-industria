import { useEffect, useMemo, useState } from 'react';
import {
  api,
  brl,
  clearSession,
  getUser,
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

export default function App() {
  const [user, setUser] = useState<User | null>(getUser());
  const [tab, setTab] = useState<Tab>('projetos');
  const [users, setUsers] = useState<User[]>([]);
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

  // medição form
  const [beneficioId, setBeneficioId] = useState('');
  const [periodo, setPeriodo] = useState('2026-04-01');
  const [valor, setValor] = useState('10000');
  const [file, setFile] = useState<File | null>(null);

  const papeis = user?.papeis ?? [];
  const isFin = papeis.includes('FINANCAS') || papeis.includes('ADMIN');
  const isVmo =
    papeis.includes('VMO_LEAD') ||
    papeis.includes('ADMIN') ||
    papeis.includes('DIRETORIA') ||
    papeis.includes('SPONSOR');

  useEffect(() => {
    if (!user) {
      api.devUsers().then(setUsers).catch((e) => setError(String(e.message || e)));
    }
  }, [user]);

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

  useEffect(() => {
    if (!user) return;
    setError('');
    refreshList().catch((e) => setError(String(e.message || e)));
  }, [user]);

  useEffect(() => {
    if (!user || !selectedId) return;
    refreshSelected(selectedId).catch((e) => setError(String(e.message || e)));
  }, [user, selectedId]);

  useEffect(() => {
    if (!user) return;
    if (tab === 'diretoria') {
      api.portfolio().then(setPortfolio).catch((e) => setError(String(e.message || e)));
    }
    if (tab === 'financas') {
      api.pendentes().then(setPendentes).catch((e) => setError(String(e.message || e)));
    }
    if (tab === 'auditoria') {
      api.auditoria().then(setAuditoria).catch((e) => setError(String(e.message || e)));
    }
  }, [tab, user]);

  const tabs = useMemo(() => {
    const t: { id: Tab; label: string }[] = [
      { id: 'projetos', label: 'Meu projeto' },
      { id: 'diretoria', label: 'Portfólio' },
    ];
    if (isFin) t.push({ id: 'financas', label: 'Homologação' });
    if (isVmo) t.push({ id: 'gates', label: 'Gates' });
    t.push({ id: 'nao', label: 'Nao' });
    if (isFin || isVmo) t.push({ id: 'auditoria', label: 'Auditoria' });
    if (isVmo) t.push({ id: 'import', label: 'Importações' });
    return t;
  }, [isFin, isVmo]);

  async function login(email: string) {
    setBusy(true);
    setError('');
    try {
      const res = await api.login(email);
      setSession(res.accessToken, res.user);
      setUser(res.user);
      setTab(res.user.papeis.includes('FINANCAS') ? 'financas' : 'projetos');
    } catch (e: any) {
      setError(e.message || String(e));
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
      setMsg('Medição enviada para homologação');
      if (selectedId) await refreshSelected(selectedId);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="login">
        <div className="login-card">
          <h1>
            Oficina de <em>Valor</em>
          </h1>
          <p className="muted">
            Plataforma VMO — value tracking, gates e homologação financeira.
            Ambiente de desenvolvimento com personas seed.
          </p>
          {error && <p className="error">{error}</p>}
          <div className="stack" style={{ marginTop: 18 }}>
            {users.map((u) => (
              <button
                key={u.id}
                className="btn secondary"
                disabled={busy}
                onClick={() => login(u.email)}
              >
                {u.nome} · {u.papeis.join(', ')}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1 className="brand">
            Oficina de <span>Valor</span>
          </h1>
          <p className="sub">
            {user.nome} · {papeis.join(' · ')} — fonte única de valor prometido vs.
            realizado
          </p>
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

      <nav className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

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
                  <div className="label">Projetos em risco (BRR&lt;70%)</div>
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
          <h2>Projetos</h2>
          <div className="list">
            {projetos.map((p) => (
              <button
                key={p.id}
                className="row"
                onClick={() => setSelectedId(p.id)}
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

              {(papeis.includes('PM') || papeis.includes('ADMIN')) && (
                <div className="stack" style={{ marginTop: 16 }}>
                  <h3>Registrar medição</h3>
                  <p className="muted">Fluxo rápido: valor + evidência + envio (&lt;2 min).</p>
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
                    Enviar para Finanças
                  </button>
                </div>
              )}
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
                    {m.beneficio?.nome} · {m.periodoReferencia?.slice?.(0, 10) || m.periodoReferencia} ·{' '}
                    {brlFmt(m.valorRealizado)}
                  </div>
                  <div className="muted">
                    Por {m.registradaPor?.nome} · evidências: {m.evidencias?.length ?? 0}
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
                        setMsg('Medição validada');
                      } catch (e: any) {
                        setError(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Validar
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
            {!pendentes.length && <p className="muted">Nenhuma medição pendente.</p>}
          </div>

          {selectedId && (
            <div className="stack">
              <h3>Importar / lançar custo realizado</h3>
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
            Premissas Finanças: {projeto.premissasOkFinancas ? 'OK' : 'pendente'}
          </p>
          {isFin && !projeto.premissasOkFinancas && (
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
                      comentario: `${g} go via UI`,
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
                    {g.decididaPor?.nome} · {new Date(g.decididaEm).toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'nao' && (
        <section className="panel stack">
          <h2>Analytics Nao</h2>
          <p className="muted">
            Snapshot DuckDB para perguntas ad-hoc (ROI, curva S, fila Finanças).
          </p>
          <div className="actions">
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await api.syncNao();
                  setMsg(
                    `Sync Nao: mode=${res.mode} ok=${res.ok ?? true} arquivos=${res.manifesto?.files?.length ?? Object.keys(res.files || {}).length}`,
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
          <ul className="muted">
            <li>Quais projetos têm BRR &lt; 70%?</li>
            <li>Hard vs soft savings YTD</li>
            <li>Aging da fila de homologação</li>
          </ul>
          <iframe className="nao-frame" title="Nao" src={api.naoUrl} />
        </section>
      )}

      {tab === 'auditoria' && (
        <section className="panel">
          <h2>Trilha de auditoria</h2>
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
          <h2>Importações</h2>
          <label className="field">
            Planilha legada (CSV projetos/benefícios)
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
            Custos ERP (CSV: projeto_ref,centro_custo,periodo,valor)
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
      <p className="muted">Verde: planejado acumulado · Laranja: realizado acumulado</p>
    </div>
  );
}
