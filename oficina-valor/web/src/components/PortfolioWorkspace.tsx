import { useMemo, useState, type FormEvent } from 'react';
import { api, brl } from '../lib/api';

type Health = 'green' | 'yellow' | 'red';

type ProjetoRow = {
  id: string;
  nome: string;
  status: string;
  area?: { nome?: string };
  analytics?: any;
  brr: number | null;
  health: Health;
  prometido: number;
  realizado: number;
  investimentoAprovado?: number | string;
  pm?: { nome?: string };
};

type ViewTab = 'board' | 'lista' | 'saude';

const STATUS_COLUMNS: { id: string; label: string }[] = [
  { id: 'conceito', label: 'Conceito' },
  { id: 'aprovado', label: 'Aprovado' },
  { id: 'execucao', label: 'Execução' },
  { id: 'hold', label: 'Hold' },
  { id: 'sustentacao', label: 'Sustentação' },
  { id: 'encerrado', label: 'Encerrado' },
  { id: 'morto', label: 'Arquivado' },
];

const HEALTH_COLUMNS: { id: Health; label: string }[] = [
  { id: 'green', label: 'On track' },
  { id: 'yellow', label: 'At risk' },
  { id: 'red', label: 'Delayed' },
];

const AREA_OPTIONS = [
  'Produção',
  'Manutenção',
  'Supply Chain',
  'TI',
  'Qualidade',
  'Geral',
];

function statusLabel(status: string) {
  return STATUS_COLUMNS.find((c) => c.id === status)?.label || status;
}

export function PortfolioWorkspace({
  portfolio,
  projetos,
  selectedId,
  onSelect,
  onOpenWizard,
  onOpenHomologacao,
  onRefresh,
  onMessage,
  onError,
}: {
  portfolio: any | null;
  projetos: ProjetoRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenWizard: (id: string) => void;
  onOpenHomologacao?: () => void;
  onRefresh: () => Promise<void>;
  onMessage: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [view, setView] = useState<ViewTab>('board');
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropCol, setDropCol] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [form, setForm] = useState({
    nome: '',
    areaNome: 'Produção',
    investimento: '100000',
    valorMensalEsperado: '8000',
    status: 'conceito',
  });

  const selected = useMemo(
    () => projetos.find((p) => p.id === selectedId) || null,
    [projetos, selectedId],
  );

  const byStatus = useMemo(() => {
    const map: Record<string, ProjetoRow[]> = {};
    for (const col of STATUS_COLUMNS) map[col.id] = [];
    for (const p of projetos) {
      const key = map[p.status] ? p.status : 'conceito';
      map[key].push(p);
    }
    return map;
  }, [projetos]);

  const byHealth = useMemo(() => {
    const map: Record<Health, ProjetoRow[]> = {
      green: [],
      yellow: [],
      red: [],
    };
    for (const p of projetos) map[p.health].push(p);
    return map;
  }, [projetos]);

  async function createProjeto(e: FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) {
      onError('Informe o nome do projeto');
      return;
    }
    setBusy(true);
    try {
      const created = await api.criarProjetoRapido({
        nome: form.nome.trim(),
        areaNome: form.areaNome,
        investimento: Number(form.investimento) || 0,
        valorMensalEsperado: Number(form.valorMensalEsperado) || 0,
        status: form.status,
      });
      setShowCreate(false);
      setForm({
        nome: '',
        areaNome: 'Produção',
        investimento: '100000',
        valorMensalEsperado: '8000',
        status: 'conceito',
      });
      onSelect(created.id);
      await onRefresh();
      onMessage(`Projeto criado · ${created.nome}`);
    } catch (err: any) {
      onError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(id: string) {
    onSelect(id);
    setDetailOpen(true);
    setBusy(true);
    try {
      const [full, analytics] = await Promise.all([
        api.projeto(id),
        api.analytics(id).catch(() => null),
      ]);
      setDetail({ ...full, analytics });
    } catch (err: any) {
      onError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function setPremissas(ok: boolean) {
    if (!selectedId) return;
    setBusy(true);
    try {
      await api.premissas(selectedId, ok);
      onMessage(ok ? 'Premissas OK (Finanças)' : 'Premissas rejeitadas');
      await openDetail(selectedId);
      await onRefresh();
    } catch (err: any) {
      onError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeProjeto(p: ProjetoRow) {
    if (
      !window.confirm(
        `Remover o projeto “${p.nome}”? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await api.removerProjeto(p.id);
      await onRefresh();
      onMessage(`Projeto removido · ${p.nome}`);
    } catch (err: any) {
      onError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function moveStatus(projetoId: string, status: string) {
    const current = projetos.find((p) => p.id === projetoId);
    if (!current || current.status === status) return;
    setBusy(true);
    try {
      await api.atualizarStatusProjeto(projetoId, status);
      await onRefresh();
      onMessage(`${current.nome} → ${statusLabel(status)}`);
    } catch (err: any) {
      onError(err.message || String(err));
    } finally {
      setBusy(false);
      setDragId(null);
      setDropCol(null);
    }
  }

  if (!portfolio) {
    return (
      <section className="panel">
        <p className="muted">Carregando portfólio…</p>
      </section>
    );
  }

  return (
    <div className="portfolio">
      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon green" aria-hidden>
            ✓
          </div>
          <div>
            <div className="value tone-green">{brl(portfolio.realizado)}</div>
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
            <div className="value tone-purple">{brl(portfolio.prometido)}</div>
            <div className="label">Baseline prometida</div>
          </div>
        </div>
      </div>

      <div className="portfolio-toolbar">
        <div className="agents-tabs portfolio-tabs">
          {(
            [
              ['board', 'Board'],
              ['lista', 'Lista'],
              ['saude', 'Por saúde'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={`agents-tab ${view === id ? 'active' : ''}`}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="top-actions">
          <span className="badge in-progress">{projetos.length} projetos</span>
          <button
            className="btn"
            disabled={busy}
            onClick={() => setShowCreate(true)}
          >
            + Novo projeto
          </button>
        </div>
      </div>

      {showCreate && (
        <section className="panel create-panel">
          <div className="panel-head">
            <h2>Novo projeto</h2>
            <button
              type="button"
              className="btn subtle"
              onClick={() => setShowCreate(false)}
            >
              Fechar
            </button>
          </div>
          <form className="create-grid" onSubmit={createProjeto}>
            <label className="field">
              Nome
              <input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex.: Redução de scrap linha B"
                autoFocus
              />
            </label>
            <label className="field">
              Área
              <select
                value={form.areaNome}
                onChange={(e) =>
                  setForm((f) => ({ ...f, areaNome: e.target.value }))
                }
              >
                {AREA_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Investimento (R$)
              <input
                type="number"
                min={0}
                value={form.investimento}
                onChange={(e) =>
                  setForm((f) => ({ ...f, investimento: e.target.value }))
                }
              />
            </label>
            <label className="field">
              Ganho mensal estimado (R$)
              <input
                type="number"
                min={0}
                value={form.valorMensalEsperado}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    valorMensalEsperado: e.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              Coluna inicial
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
              >
                {STATUS_COLUMNS.filter((c) => c.id !== 'morto').map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="create-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowCreate(false)}
              >
                Cancelar
              </button>
              <button className="btn" type="submit" disabled={busy}>
                {busy ? 'Salvando…' : 'Criar projeto'}
              </button>
            </div>
          </form>
        </section>
      )}

      {view === 'board' && (
        <div className="kanban" data-dragging={dragId ? '1' : '0'}>
          {STATUS_COLUMNS.map((col) => (
            <section
              key={col.id}
              className={`kanban-col ${dropCol === col.id ? 'is-drop' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDropCol(col.id);
              }}
              onDragLeave={() => setDropCol((c) => (c === col.id ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/projeto-id') || dragId;
                if (id) void moveStatus(id, col.id);
              }}
            >
              <header className="kanban-col-head">
                <strong>{col.label}</strong>
                <span>{byStatus[col.id]?.length || 0}</span>
              </header>
              <div className="kanban-cards">
                {(byStatus[col.id] || []).map((p) => (
                  <article
                    key={p.id}
                    className={`kanban-card ${selectedId === p.id ? 'selected' : ''} ${dragId === p.id ? 'dragging' : ''}`}
                    draggable={!busy}
                    onDragStart={(e) => {
                      setDragId(p.id);
                      e.dataTransfer.setData('text/projeto-id', p.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDropCol(null);
                    }}
                    onClick={() => void openDetail(p.id)}
                  >
                    <div className="kanban-card-top">
                      <span className={`rag-dot ${p.health}`} />
                      <strong>{p.nome}</strong>
                    </div>
                    <div className="kanban-card-meta">
                      <span>{p.area?.nome || 'Área'}</span>
                      <span>{p.analytics?.roiLabel ?? '—'}</span>
                    </div>
                    <div className="kanban-card-metrics">
                      <span>{brl(p.realizado)}</span>
                      <span>
                        {p.brr == null ? '—' : `${Math.round(p.brr * 100)}% BRR`}
                      </span>
                    </div>
                    <div className="kanban-card-actions">
                      <button
                        type="button"
                        className="linkish"
                        onClick={(e) => {
                          e.stopPropagation();
                          void openDetail(p.id);
                        }}
                      >
                        Detalhes
                      </button>
                      <button
                        type="button"
                        className="linkish"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenWizard(p.id);
                        }}
                      >
                        Wizard
                      </button>
                      <button
                        type="button"
                        className="linkish danger"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          void removeProjeto(p);
                        }}
                      >
                        Remover
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {view === 'saude' && (
        <div className="kanban health-board">
          {HEALTH_COLUMNS.map((col) => (
            <section key={col.id} className="kanban-col">
              <header className="kanban-col-head">
                <strong>
                  <i className={`rag-dot ${col.id}`} /> {col.label}
                </strong>
                <span>{byHealth[col.id].length}</span>
              </header>
              <div className="kanban-cards">
                {byHealth[col.id].map((p) => (
                  <article
                    key={p.id}
                    className={`kanban-card ${selectedId === p.id ? 'selected' : ''}`}
                    onClick={() => void openDetail(p.id)}
                  >
                    <div className="kanban-card-top">
                      <strong>{p.nome}</strong>
                    </div>
                    <div className="kanban-card-meta">
                      <span>{statusLabel(p.status)}</span>
                      <span>{p.area?.nome || 'Área'}</span>
                    </div>
                    <div className="kanban-card-metrics">
                      <span>{brl(p.realizado)}</span>
                      <span>
                        {p.brr == null ? '—' : `${Math.round(p.brr * 100)}% BRR`}
                      </span>
                    </div>
                    <div className="kanban-card-actions">
                      <button
                        type="button"
                        className="linkish"
                        onClick={(e) => {
                          e.stopPropagation();
                          void openDetail(p.id);
                        }}
                      >
                        Detalhes
                      </button>
                      <button
                        type="button"
                        className="linkish"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenWizard(p.id);
                        }}
                      >
                        Wizard
                      </button>
                      <button
                        type="button"
                        className="linkish danger"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          void removeProjeto(p);
                        }}
                      >
                        Remover
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {view === 'lista' && (
        <section className="panel">
          <div className="panel-head">
            <h2>Health por projeto</h2>
            <span className="meta">{projetos.length} programas</span>
          </div>
          <div className="rag-table-wrap">
            <table className="rag-table">
              <thead>
                <tr>
                  <th>Programa</th>
                  <th>Status</th>
                  <th>Prometido</th>
                  <th>Realizado</th>
                  <th>BRR</th>
                  <th>ROI</th>
                  <th>Overall</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projetos.map((p) => {
                  const brrPct = p.brr == null ? null : Math.round(p.brr * 100);
                  return (
                    <tr
                      key={p.id}
                      className={selectedId === p.id ? 'is-selected' : ''}
                      onClick={() => void openDetail(p.id)}
                    >
                      <td>
                        <strong>{p.nome}</strong>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {p.area?.nome}
                        </div>
                      </td>
                      <td>
                        <span className="badge in-progress">
                          {statusLabel(p.status)}
                        </span>
                      </td>
                      <td>{brl(p.prometido)}</td>
                      <td>{brl(p.realizado)}</td>
                      <td>{brrPct == null ? '—' : `${brrPct}%`}</td>
                      <td>{p.analytics?.roiLabel ?? '—'}</td>
                      <td>
                        <span className={`rag-dot ${p.health}`} />
                      </td>
                      <td>
                        <div className="lista-actions">
                          <button
                            type="button"
                            className="linkish"
                            onClick={(e) => {
                              e.stopPropagation();
                              void openDetail(p.id);
                            }}
                          >
                            Detalhes
                          </button>
                          <button
                            type="button"
                            className="linkish"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenWizard(p.id);
                            }}
                          >
                            Wizard
                          </button>
                          <button
                            type="button"
                            className="linkish danger"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              void removeProjeto(p);
                            }}
                          >
                            Remover
                          </button>
                        </div>
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
      )}

      {detailOpen && (selected || detail) && (
        <div className="drawer-backdrop" onClick={() => setDetailOpen(false)}>
          <aside
            className="project-detail-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-head">
              <div>
                <button
                  type="button"
                  className="linkish"
                  onClick={() => setDetailOpen(false)}
                >
                  ← Fechar
                </button>
                <h2 style={{ margin: '8px 0 0' }}>
                  {detail?.nome || selected?.nome}
                </h2>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {statusLabel(detail?.status || selected?.status || '')} ·{' '}
                  {detail?.area?.nome || selected?.area?.nome || 'Área'}
                </p>
              </div>
              <span
                className={`rag-dot ${selected?.health || 'yellow'}`}
                title="Saúde BRR"
              />
            </div>
            <div className="drawer-body">
              <div className="detail-kv">
                <span>Prometido</span>
                <strong>{brl(selected?.prometido ?? 0)}</strong>
              </div>
              <div className="detail-kv">
                <span>Realizado</span>
                <strong>{brl(selected?.realizado ?? 0)}</strong>
              </div>
              <div className="detail-kv">
                <span>BRR</span>
                <strong>
                  {selected?.brr == null
                    ? '—'
                    : `${Math.round(selected.brr * 100)}%`}
                </strong>
              </div>
              <div className="detail-kv">
                <span>ROI</span>
                <strong>{selected?.analytics?.roiLabel ?? '—'}</strong>
              </div>
              <div className="detail-kv">
                <span>Investimento</span>
                <strong>{brl(detail?.investimentoAprovado ?? selected?.investimentoAprovado ?? 0)}</strong>
              </div>
              <div className="detail-kv">
                <span>PM</span>
                <strong>{detail?.pm?.nome || selected?.pm?.nome || '—'}</strong>
              </div>
              <div className="detail-kv">
                <span>Premissas Finanças</span>
                <strong>
                  {detail?.premissasOkFinancas ? 'OK' : 'Pendente'}
                </strong>
              </div>
              <div className="detail-kv">
                <span>Baseline wizard</span>
                <strong>
                  {detail?.wizardBaselineCompleto ? 'Completo' : 'Pendente'}
                </strong>
              </div>
              <div className="detail-kv">
                <span>Benefícios</span>
                <strong>
                  {detail?.businessCase?.beneficios?.length ?? 0}
                </strong>
              </div>
            </div>
            <div className="drawer-foot">
              {!detail?.premissasOkFinancas && (
                <button
                  className="btn secondary"
                  disabled={busy || !selectedId}
                  onClick={() => void setPremissas(true)}
                >
                  Premissas OK
                </button>
              )}
              {onOpenHomologacao && (
                <button className="btn secondary" onClick={onOpenHomologacao}>
                  Homologação
                </button>
              )}
              <button
                className="btn"
                disabled={!selectedId}
                onClick={() => selectedId && onOpenWizard(selectedId)}
              >
                Wizard
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
