import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

type Tab = 'overview' | 'recommendations' | 'activity';

const AGENT_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'captura', label: 'Captura' },
  { id: 'roi_auditor', label: 'ROI' },
  { id: 'curva_s', label: 'Curva S' },
  { id: 'risco', label: 'Risco' },
  { id: 'insights', label: 'Insights' },
] as const;

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function agentColor(code: string, meta?: Record<string, { color: string }>) {
  if (meta?.[code]?.color) return meta[code].color;
  const map: Record<string, string> = {
    chief: '#0c66e4',
    captura: '#e56910',
    roi_auditor: '#0c66e4',
    curva_s: '#1d7afc',
    risco: '#22a06b',
    insights: '#f5cd47',
  };
  return map[code] || '#8590a2';
}

function agentLabel(code: string, meta?: Record<string, { label: string }>) {
  if (code === 'chief') return meta?.[code]?.label || 'Maestro';
  return meta?.[code]?.label || code;
}

export function AgentsWorkspace({
  onNavigate,
  onMessage,
  onError,
}: {
  onNavigate: (nav: {
    tab: string;
    projetoId?: string;
    wizardTipo?: string;
    prompt?: string;
    message?: string;
  }) => void;
  onMessage: (m: string) => void;
  onError: (e: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [recs, setRecs] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [agentFilter, setAgentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<any | null>(null);
  const [showReasoning, setShowReasoning] = useState<Record<string, boolean>>(
    {},
  );

  const load = useCallback(async () => {
    try {
      const [ov, r, a] = await Promise.all([
        api.agentsOverview(),
        api.agentsRecommendations(),
        api.agentsActivity(),
      ]);
      setOverview(ov);
      setRecs(r);
      setActivity(a);
    } catch (e: any) {
      onError(e.message || String(e));
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = overview?.kpis?.awaiting ?? 0;

  const filteredRecs = useMemo(() => {
    return recs.filter((r) => {
      if (agentFilter !== 'all' && r.agent !== agentFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });
  }, [recs, agentFilter, statusFilter]);

  const filteredActivity = useMemo(() => {
    return activity.filter((a) => {
      if (agentFilter !== 'all' && a.agent !== agentFilter) return false;
      if (
        statusFilter !== 'all' &&
        (a.statusBadge || '').toLowerCase() !== statusFilter.toLowerCase()
      ) {
        return false;
      }
      return true;
    });
  }, [activity, agentFilter, statusFilter]);

  async function scan() {
    setBusy(true);
    try {
      const res = await api.agentsScan();
      onMessage(`Maestro · ${res.created} recomendações`);
      await load();
      setTab('recommendations');
    } catch (e: any) {
      onError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function setMode(mode: 'assisted' | 'automated') {
    setBusy(true);
    try {
      await api.agentsSetMode(mode);
      await load();
      onMessage(`Modo ${mode === 'assisted' ? 'Assistido' : 'Automático'}`);
    } catch (e: any) {
      onError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function accept(id: string) {
    setBusy(true);
    try {
      const res = await api.agentsAccept(id);
      onMessage('Recomendação aceita');
      setDrawer(null);
      await load();
      if (res.navigation) onNavigate(res.navigation);
    } catch (e: any) {
      onError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function reject(id: string) {
    setBusy(true);
    try {
      await api.agentsReject(id);
      onMessage('Recomendação rejeitada');
      setDrawer(null);
      await load();
    } catch (e: any) {
      onError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const mode = overview?.mode || 'assisted';
  const meta = overview?.agents;

  return (
    <div className="agents">
      <div className="agents-hero">
        <div>
          <h2>Agents</h2>
        </div>
        <div className="top-actions">
          <div className="mode-toggle">
            <button
              className={`mode-pill ${mode === 'automated' ? 'active' : ''}`}
              onClick={() => void setMode('automated')}
              disabled={busy}
            >
              <span className="orb sm blue" /> Automático
            </button>
            <button
              className={`mode-pill ${mode === 'assisted' ? 'active' : ''}`}
              onClick={() => void setMode('assisted')}
              disabled={busy}
            >
              Assistido
            </button>
          </div>
          <button className="btn secondary" disabled={busy} onClick={scan}>
            Escanear
          </button>
        </div>
      </div>

      <div className="agents-tabs">
        {(
          [
            ['overview', 'Visão geral'],
            ['recommendations', `Recomendações${pendingCount ? ` (${pendingCount})` : ''}`],
            ['activity', 'Atividade'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={`agents-tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== 'overview' && (
        <div className="toolbar">
          {tab === 'activity' && <span className="live-dot">AO VIVO</span>}
          <div className="filter-pills">
            {AGENT_FILTERS.map((f) => (
              <button
                key={f.id}
                className={`chip-btn ${agentFilter === f.id ? 'active' : ''}`}
                onClick={() => setAgentFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <select
            className="chip-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos status</option>
            <option value="pending">Pendente</option>
            <option value="accepted">Aceitas</option>
            <option value="rejected">Rejeitadas</option>
            <option value="auto">Auto</option>
          </select>
        </div>
      )}

      {tab === 'overview' && overview && (
        <>
          <div className="kpi-row agents-kpi">
            <article className="kpi-card">
              <div className="label">Ações</div>
              <div className="value">{overview.kpis.actions}</div>
            </article>
            <article className="kpi-card">
              <div className="label">Sucesso</div>
              <div className="value tone-green">{overview.kpis.successPct}%</div>
            </article>
            <article className="kpi-card">
              <div className="label">Aguardando</div>
              <div className="value tone-orange">{overview.kpis.awaiting}</div>
            </article>
            <article className="kpi-card">
              <div className="label">Auto</div>
              <div className="value tone-blue">{overview.kpis.auto}</div>
            </article>
          </div>

          <section className="panel hierarchy-panel">
            <div className="panel-head">
              <h2>Orquestração</h2>
              <span className="meta">
                {overview.hierarchy.specialists.reduce(
                  (n: number, s: any) => n + (s.pending || 0),
                  0,
                )}{' '}
                pendentes
              </span>
            </div>
            <div className="agent-tree">
              <div className="maestro-rail">
                <button
                  type="button"
                  className="maestro-node"
                  onClick={() => {
                    setAgentFilter('all');
                    setTab('recommendations');
                  }}
                >
                  <span className="orb lg blue maestro-orb" aria-hidden />
                  <div className="maestro-copy">
                    <strong>{overview.hierarchy.chief.label}</strong>
                    <span className="maestro-mode">
                      {mode === 'automated' ? 'Automático' : 'Assistido'}
                    </span>
                  </div>
                  <span className="maestro-stat">
                    <em>{overview.kpis.awaiting}</em>
                    na fila
                  </span>
                </button>
                <div className="tree-stem" aria-hidden />
                <div className="tree-rail" aria-hidden />
              </div>
              <div className="agent-branches">
                {overview.hierarchy.specialists.map((s: any, idx: number) => {
                  const hot = (s.pending || 0) > 0;
                  return (
                    <button
                      key={s.codigo}
                      type="button"
                      className={`agent-node ${hot ? 'has-pending' : ''}`}
                      style={{ animationDelay: `${idx * 45}ms` }}
                      onClick={() => {
                        setAgentFilter(s.codigo);
                        setTab('recommendations');
                      }}
                    >
                      <span className="agent-node-top">
                        <span
                          className="orb md"
                          style={{ background: s.color }}
                          aria-hidden
                        />
                        <strong>{s.label}</strong>
                      </span>
                      <span className={`pending-foot ${hot ? 'hot' : ''}`}>
                        <em>{s.pending}</em>
                        {hot ? 'pendentes' : 'em dia'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Status ao vivo</h2>
              <span className="meta">{overview.liveDots?.length || 0} projetos</span>
            </div>
            <div className="live-grid">
              {(overview.liveDots || []).map((d: any) => (
                <span
                  key={d.projetoId}
                  className="live-cell"
                  style={{ background: d.color }}
                  title={`${d.nome} · ${d.agent === 'chief' ? 'Maestro' : d.agent}`}
                />
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Ações recentes</h2>
            </div>
            <div className="recent-list">
              {(overview.recentActions || []).slice(0, 8).map((a: any) => (
                <div key={a.id} className="recent-row">
                  <span
                    className="dot"
                    style={{ background: agentColor(a.agent, meta) }}
                  />
                  <strong>{agentLabel(a.agent, meta)}</strong>
                  <span className="muted">{a.summary}</span>
                  <span className="muted">{timeAgo(a.createdAt)}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {tab === 'recommendations' && (
        <div className="reco-list">
          {filteredRecs.map((r) => {
            const reasoning = r.reasoning || {};
            const open = !!showReasoning[r.id];
            return (
              <article key={r.id} className="reco-card">
                <div className="reco-head">
                  <strong>{r.codigo}</strong>
                  <span className="agent-tag">
                    <i style={{ background: agentColor(r.agent, meta) }} />
                    {agentLabel(r.agent, meta)}
                  </span>
                  <span className="muted">{timeAgo(r.createdAt)}</span>
                  <span className={`status-badge ${r.status}`}>{r.status}</span>
                </div>
                <p className="reco-action">{r.acaoProposta}</p>
                {r.projeto?.nome && (
                  <p className="muted" style={{ margin: '0 0 8px' }}>
                    Projeto · {r.projeto.nome}
                  </p>
                )}
                <div className="reco-meta">
                  <span className="match-pill">{r.confidence}% Match</span>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() =>
                      setShowReasoning((s) => ({ ...s, [r.id]: !s[r.id] }))
                    }
                  >
                    {open ? 'Ocultar raciocínio' : 'Ver raciocínio'}
                  </button>
                  {r.status === 'pending' && (
                    <span className="waiting">Aguardando</span>
                  )}
                </div>
                {open && (
                  <div className="reasoning-box">
                    <p>{reasoning.summary}</p>
                    {Array.isArray(reasoning.inputs) && (
                      <ul>
                        {reasoning.inputs.map((x: string) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    )}
                    {reasoning.logic && (
                      <p className="muted italic">{reasoning.logic}</p>
                    )}
                    <div className="confidence-bar">
                      <span>CONFIDENCE</span>
                      <div className="progress-track">
                        <i
                          className="progress"
                          style={{ width: `${r.confidence}%` }}
                        />
                      </div>
                      <strong>{r.confidence}%</strong>
                    </div>
                  </div>
                )}
                {r.status === 'pending' && (
                  <div className="reco-actions">
                    <button
                      className="btn secondary"
                      onClick={() => {
                        setDrawer(r);
                        setShowReasoning((s) => ({ ...s, [r.id]: true }));
                      }}
                    >
                      Details
                    </button>
                    <button
                      className="btn reject"
                      disabled={busy}
                      onClick={() => void reject(r.id)}
                    >
                      Rejeitar
                    </button>
                    <button
                      className="btn accept"
                      disabled={busy}
                      onClick={() => void accept(r.id)}
                    >
                      Aceitar
                    </button>
                  </div>
                )}
              </article>
            );
          })}
          {!filteredRecs.length && (
            <div className="empty-state">
              <strong>Nenhuma recomendação</strong>
              <span>Execute Escanear para o Maestro orquestrar os especialistas.</span>
              <button className="btn" onClick={scan} disabled={busy}>
                Escanear
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="activity-list">
          {filteredActivity.map((a) => {
            const open = expanded === a.id;
            const detail = a.detail || {};
            return (
              <article key={a.id} className="activity-card">
                <div className="activity-time">{timeAgo(a.createdAt)}</div>
                <div className="activity-body">
                  <div className="reco-head">
                    <span className="agent-tag">
                      <i style={{ background: agentColor(a.agent, meta) }} />
                      {agentLabel(a.agent, meta)}
                    </span>
                    {a.statusBadge && (
                      <span
                        className={`status-badge ${String(a.statusBadge).toLowerCase()}`}
                      >
                        {a.statusBadge}
                      </span>
                    )}
                  </div>
                  <p>{a.summary}</p>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => setExpanded(open ? null : a.id)}
                  >
                    {open ? 'Hide' : 'Expand'}
                  </button>
                  {open && (
                    <div className="reasoning-box">
                      {Array.isArray(detail.reasoning?.inputs) && (
                        <>
                          <strong>Inputs considered</strong>
                          <ul>
                            {detail.reasoning.inputs.map((x: string) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      {detail.reasoning?.logic && (
                        <>
                          <strong>Decision logic</strong>
                          <p className="muted italic">{detail.reasoning.logic}</p>
                        </>
                      )}
                      {detail.confidence != null && (
                        <div className="confidence-bar">
                          <span>CONFIDENCE</span>
                          <div className="progress-track">
                            <i
                              className="progress"
                              style={{ width: `${detail.confidence}%` }}
                            />
                          </div>
                          <strong>{detail.confidence}%</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
          {!filteredActivity.length && (
            <p className="muted">Sem atividade ainda.</p>
          )}
        </div>
      )}

      {drawer && (
        <div className="drawer-backdrop" onClick={() => setDrawer(null)}>
          <aside
            className="agent-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-head">
              <div>
                <button
                  type="button"
                  className="linkish"
                  onClick={() => setDrawer(null)}
                >
                  ← Back
                </button>
                <h2>{drawer.codigo}</h2>
                <p className="muted">{timeAgo(drawer.createdAt)}</p>
              </div>
              <button
                type="button"
                className="btn subtle"
                onClick={() => setDrawer(null)}
              >
                ✕
              </button>
            </div>

            <div className="ai-summary-card">
              <div className="ai-summary-head">
                <span
                  className="orb md"
                  style={{ background: agentColor(drawer.agent, meta) }}
                />
                <div>
                  <strong>{agentLabel(drawer.agent, meta)}</strong>
                </div>
                <span className="match-pill">{drawer.confidence}% Match</span>
              </div>
              <div className="ai-summary-body">
                <div className="label">AI SUMMARY</div>
                <p>{drawer.reasoning?.summary || drawer.acaoProposta}</p>
              </div>
            </div>

            <h3>Proposed action</h3>
            <p>{drawer.acaoProposta}</p>
            {drawer.projeto && (
              <p className="muted">Projeto · {drawer.projeto.nome}</p>
            )}

            {Array.isArray(drawer.reasoning?.inputs) && (
              <>
                <h3>Inputs</h3>
                <ul className="drawer-list">
                  {drawer.reasoning.inputs.map((x: string) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </>
            )}

            <div className="drawer-footer">
              <button className="btn secondary" onClick={() => setDrawer(null)}>
                Close
              </button>
              <button
                className="btn reject"
                disabled={busy}
                onClick={() => void reject(drawer.id)}
              >
                Rejeitar
              </button>
              <button
                className="btn accept"
                disabled={busy}
                onClick={() => void accept(drawer.id)}
              >
                Aceitar e aplicar
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
