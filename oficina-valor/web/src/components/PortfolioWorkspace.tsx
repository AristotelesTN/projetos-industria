import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, brl } from '../lib/api';
import { FitText } from './FitText';

type Health = 'green' | 'yellow' | 'red';

type PapelFapd = 'estruturante' | 'gerador';

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
  notaOe1?: number | null;
  notaOe3?: number | null;
  notaOe4?: number | null;
  notaOe5Sust?: number | null;
  notaOe5Tech?: number | null;
  naOe1?: boolean;
  naOe3?: boolean;
  naOe4?: boolean;
  naOe5Sust?: boolean;
  naOe5Tech?: boolean;
  papelEstrategico?: PapelFapd | null;
  comentarioFapd?: string | null;
  memoriaCalculoGanho?: string | null;
  comentarios?: string | null;
  opexGerado?: number | string | null;
};

type ViewTab = 'board' | 'lista' | 'saude';

type FapdForm = {
  notaOe1: string;
  notaOe3: string;
  notaOe4: string;
  notaOe5Sust: string;
  notaOe5Tech: string;
  naOe1: boolean;
  naOe3: boolean;
  naOe4: boolean;
  naOe5Sust: boolean;
  naOe5Tech: boolean;
  papelEstrategico: '' | PapelFapd;
  comentarioFapd: string;
};

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

const OE_FIELDS: {
  key: 'Oe1' | 'Oe3' | 'Oe4' | 'Oe5Sust' | 'Oe5Tech';
  label: string;
  hint: string;
}[] = [
  { key: 'Oe1', label: 'OE1', hint: 'Estratégia / alinhamento' },
  { key: 'Oe3', label: 'OE3', hint: 'Valor / benefício' },
  { key: 'Oe4', label: 'OE4', hint: 'Execução / capacidade' },
  { key: 'Oe5Sust', label: 'OE5 Sust.', hint: 'Sustentação' },
  { key: 'Oe5Tech', label: 'OE5 Tech', hint: 'Tecnologia' },
];

const EMPTY_FAPD: FapdForm = {
  notaOe1: '',
  notaOe3: '',
  notaOe4: '',
  notaOe5Sust: '',
  notaOe5Tech: '',
  naOe1: false,
  naOe3: false,
  naOe4: false,
  naOe5Sust: false,
  naOe5Tech: false,
  papelEstrategico: '',
  comentarioFapd: '',
};

function statusLabel(status: string) {
  return STATUS_COLUMNS.find((c) => c.id === status)?.label || status;
}

function fapdFromProjeto(p: any | null | undefined): FapdForm {
  if (!p) return { ...EMPTY_FAPD };
  return {
    notaOe1: p.notaOe1 == null ? '' : String(p.notaOe1),
    notaOe3: p.notaOe3 == null ? '' : String(p.notaOe3),
    notaOe4: p.notaOe4 == null ? '' : String(p.notaOe4),
    notaOe5Sust: p.notaOe5Sust == null ? '' : String(p.notaOe5Sust),
    notaOe5Tech: p.notaOe5Tech == null ? '' : String(p.notaOe5Tech),
    naOe1: Boolean(p.naOe1),
    naOe3: Boolean(p.naOe3),
    naOe4: Boolean(p.naOe4),
    naOe5Sust: Boolean(p.naOe5Sust),
    naOe5Tech: Boolean(p.naOe5Tech),
    papelEstrategico: (p.papelEstrategico as PapelFapd) || '',
    comentarioFapd: p.comentarioFapd || '',
  };
}

function mediaFapd(p: {
  notaOe1?: number | null;
  notaOe3?: number | null;
  notaOe4?: number | null;
  notaOe5Sust?: number | null;
  notaOe5Tech?: number | null;
  naOe1?: boolean;
  naOe3?: boolean;
  naOe4?: boolean;
  naOe5Sust?: boolean;
  naOe5Tech?: boolean;
}): string {
  const pairs: [number | null | undefined, boolean | undefined][] = [
    [p.notaOe1, p.naOe1],
    [p.notaOe3, p.naOe3],
    [p.notaOe4, p.naOe4],
    [p.notaOe5Sust, p.naOe5Sust],
    [p.notaOe5Tech, p.naOe5Tech],
  ];
  const vals = pairs
    .filter(([, na]) => !na)
    .map(([n]) => n)
    .filter((n): n is number => n != null && !Number.isNaN(Number(n)));
  if (!vals.length) return '—';
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

function papelLabel(papel?: PapelFapd | null) {
  if (papel === 'estruturante') return 'Estruturante';
  if (papel === 'gerador') return 'Gerador';
  return null;
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
  const [fapd, setFapd] = useState<FapdForm>({ ...EMPTY_FAPD });
  const [anotacoes, setAnotacoes] = useState({
    memoriaCalculoGanho: '',
    comentarios: '',
    opexGerado: '',
  });
  const [goNoGoJustificativa, setGoNoGoJustificativa] = useState('');
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

  useEffect(() => {
    const src = detail || selected;
    setFapd(fapdFromProjeto(src));
    setAnotacoes({
      memoriaCalculoGanho: src?.memoriaCalculoGanho || '',
      comentarios: src?.comentarios || '',
      opexGerado:
        src?.opexGerado == null || src?.opexGerado === ''
          ? ''
          : String(src.opexGerado),
    });
  }, [detail, selected]);

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

  async function saveAvaliacaoFapd() {
    if (!selectedId) return;
    setBusy(true);
    try {
      const parseNota = (raw: string, na: boolean) => {
        if (na) return null;
        if (raw.trim() === '') return null;
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0 || n > 5) {
          throw new Error('Notas OE devem ser inteiros de 0 a 5 (ou N/A)');
        }
        return n;
      };
      const updated = await api.atualizarAvaliacaoFapd(selectedId, {
        notaOe1: parseNota(fapd.notaOe1, fapd.naOe1),
        notaOe3: parseNota(fapd.notaOe3, fapd.naOe3),
        notaOe4: parseNota(fapd.notaOe4, fapd.naOe4),
        notaOe5Sust: parseNota(fapd.notaOe5Sust, fapd.naOe5Sust),
        notaOe5Tech: parseNota(fapd.notaOe5Tech, fapd.naOe5Tech),
        naOe1: fapd.naOe1,
        naOe3: fapd.naOe3,
        naOe4: fapd.naOe4,
        naOe5Sust: fapd.naOe5Sust,
        naOe5Tech: fapd.naOe5Tech,
        papelEstrategico: fapd.papelEstrategico || null,
        comentarioFapd: fapd.comentarioFapd.trim() || null,
      });
      setDetail((prev: any) => ({ ...(prev || {}), ...updated }));
      setFapd(fapdFromProjeto(updated));
      await onRefresh();
      onMessage('Avaliação salva');
    } catch (err: any) {
      onError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveAnotacoes() {
    if (!selectedId) return;
    setBusy(true);
    try {
      const opexRaw = anotacoes.opexGerado.trim().replace(',', '.');
      const opexGerado =
        opexRaw === '' ? null : Number(opexRaw);
      if (opexGerado != null && Number.isNaN(opexGerado)) {
        onError('OPEX Gerado inválido');
        return;
      }
      const updated = await api.atualizarAnotacoesProjeto(selectedId, {
        memoriaCalculoGanho: anotacoes.memoriaCalculoGanho.trim() || null,
        comentarios: anotacoes.comentarios.trim() || null,
        opexGerado,
      });
      setDetail((prev: any) => ({ ...(prev || {}), ...updated }));
      setAnotacoes({
        memoriaCalculoGanho: updated.memoriaCalculoGanho || '',
        comentarios: updated.comentarios || '',
        opexGerado:
          updated.opexGerado == null ? '' : String(updated.opexGerado),
      });
      await onRefresh();
      onMessage('Memória, OPEX e comentários salvos');
    } catch (err: any) {
      onError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function decidirProjeto(decisao: 'aprovado' | 'reprovado') {
    if (!selectedId) return;
    if (decisao === 'reprovado' && !goNoGoJustificativa.trim()) {
      onError('Informe a justificativa da reprovação');
      return;
    }
    setBusy(true);
    try {
      const updated = await api.decidirProjeto(selectedId, {
        decisao,
        justificativa: goNoGoJustificativa.trim() || undefined,
      });
      setDetail((prev: any) => ({ ...(prev || {}), ...updated }));
      setGoNoGoJustificativa('');
      await onRefresh();
      onMessage(
        decisao === 'aprovado'
          ? 'Projeto aprovado (go)'
          : 'Projeto reprovado (arquivado)',
      );
    } catch (err: any) {
      onError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function marcarPosFeito() {
    if (!selectedId) return;
    setBusy(true);
    try {
      const updated = await api.acompanhamentoPosFeito(selectedId);
      setDetail((prev: any) => ({ ...(prev || {}), ...updated }));
      await onRefresh();
      onMessage('Acompanhamento pós-projeto marcado');
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
          <div className="metric-body">
            <FitText className="value tone-green">
              {brl(portfolio.realizado)}
            </FitText>
            <div className="label">Valor homologado</div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon blue" aria-hidden>
            ◆
          </div>
          <div className="metric-body">
            <FitText className="value tone-blue">
              {portfolio.roiLabel}
            </FitText>
            <div className="label">ROI do portfólio</div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon orange" aria-hidden>
            !
          </div>
          <div className="metric-body">
            <FitText className="value tone-orange">
              {portfolio.projetosEmRisco}
            </FitText>
            <div className="label">Em risco (BRR &lt; 70%)</div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon purple" aria-hidden>
            ≡
          </div>
          <div className="metric-body">
            <FitText className="value tone-purple">
              {brl(portfolio.prometido)}
            </FitText>
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
            <h2>Portfólio · lista</h2>
            <span className="meta">{projetos.length} programas</span>
          </div>
          <div className="rag-table-wrap">
            <table className="rag-table">
              <thead>
                <tr>
                  <th>Programa</th>
                  <th>Status</th>
                  <th>Nota</th>
                  <th>Papel</th>
                  <th>Memória</th>
                  <th>Investimento</th>
                  <th>Realizado</th>
                  <th>BRR</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projetos.map((p) => {
                  const brrPct = p.brr == null ? null : Math.round(p.brr * 100);
                  const papel = papelLabel(p.papelEstrategico);
                  const temMemoria = Boolean(
                    p.memoriaCalculoGanho?.trim() || p.comentarios?.trim(),
                  );
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
                      <td>{mediaFapd(p)}</td>
                      <td>
                        {papel ? (
                          <span
                            className={`badge ${
                              p.papelEstrategico === 'estruturante'
                                ? 'info'
                                : 'success'
                            }`}
                          >
                            {papel}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        {temMemoria ? (
                          <span className="badge success" title="Com memória/comentários">
                            Sim
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>{brl(p.investimentoAprovado ?? 0)}</td>
                      <td>{brl(p.realizado)}</td>
                      <td>{brrPct == null ? '—' : `${brrPct}%`}</td>
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
                <strong>
                  {detail?.analytics?.roiLabel ||
                    selected?.analytics?.roiLabel ||
                    '—'}
                </strong>
              </div>
              <div className="detail-kv">
                <span>OPEX Gerado</span>
                <strong>
                  {(() => {
                    const v =
                      detail?.opexGerado ??
                      selected?.opexGerado ??
                      anotacoes.opexGerado;
                    if (v == null || v === '') return '—';
                    const n = Number(v);
                    return Number.isNaN(n) ? '—' : brl(n);
                  })()}
                </strong>
              </div>
              <div className="detail-kv">
                <span>Investimento</span>
                <strong>
                  {brl(
                    detail?.investimentoAprovado ??
                      selected?.investimentoAprovado ??
                      0,
                  )}
                </strong>
              </div>
              <div className="detail-kv">
                <span>PM</span>
                <strong>{detail?.pm?.nome || selected?.pm?.nome || '—'}</strong>
              </div>

              <div className="fapd-block">
                <h3>Ganho · memória de cálculo</h3>
                <p className="muted fapd-lead">
                  Descreva como o ganho é calculado (premissas, fórmula, fontes e
                  unidades) e registre comentários do projeto.
                </p>
                <label className="fapd-field">
                  <span>OPEX Gerado (R$)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={busy}
                    value={anotacoes.opexGerado}
                    onChange={(e) =>
                      setAnotacoes((a) => ({
                        ...a,
                        opexGerado: e.target.value,
                      }))
                    }
                    placeholder="Ex.: 24300"
                  />
                </label>
                <label className="fapd-field">
                  <span>Memória de cálculo</span>
                  <textarea
                    rows={5}
                    disabled={busy}
                    value={anotacoes.memoriaCalculoGanho}
                    onChange={(e) =>
                      setAnotacoes((a) => ({
                        ...a,
                        memoriaCalculoGanho: e.target.value,
                      }))
                    }
                    placeholder="Ex.: Ganho mensal = (horas poupadas × custo/hora) − custo operacional; fonte ERP CC-120…"
                  />
                </label>
                <label className="fapd-field">
                  <span>Comentários</span>
                  <textarea
                    rows={4}
                    disabled={busy}
                    value={anotacoes.comentarios}
                    onChange={(e) =>
                      setAnotacoes((a) => ({
                        ...a,
                        comentarios: e.target.value,
                      }))
                    }
                    placeholder="Acompanhamento, riscos, alinhamentos com o sponsor…"
                  />
                </label>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy || !selectedId}
                  onClick={() => void saveAnotacoes()}
                >
                  Salvar memória e comentários
                </button>
              </div>

              <div className="fapd-block">
                <h3>Avaliação</h3>
                <p className="muted fapd-lead">
                  Notas 0–5 por objetivo estratégico (ou N/A), papel na matriz e
                  comentário curto.
                </p>
                <div className="fapd-oe-grid">
                  {OE_FIELDS.map((oe) => {
                    const notaKey = `nota${oe.key}` as keyof FapdForm;
                    const naKey = `na${oe.key}` as keyof FapdForm;
                    const na = Boolean(fapd[naKey]);
                    return (
                      <label key={oe.key} className="fapd-oe">
                        <span className="fapd-oe-label">
                          {oe.label}
                          <small>{oe.hint}</small>
                        </span>
                        <div className="fapd-oe-controls">
                          <input
                            type="number"
                            min={0}
                            max={5}
                            step={1}
                            disabled={na || busy}
                            value={na ? '' : String(fapd[notaKey] ?? '')}
                            onChange={(e) =>
                              setFapd((f) => ({
                                ...f,
                                [notaKey]: e.target.value,
                              }))
                            }
                            placeholder="0–5"
                          />
                          <label className="fapd-na">
                            <input
                              type="checkbox"
                              checked={na}
                              disabled={busy}
                              onChange={(e) =>
                                setFapd((f) => ({
                                  ...f,
                                  [naKey]: e.target.checked,
                                  ...(e.target.checked
                                    ? { [notaKey]: '' }
                                    : {}),
                                }))
                              }
                            />
                            N/A
                          </label>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <label className="fapd-field">
                  <span>Papel estratégico</span>
                  <select
                    value={fapd.papelEstrategico}
                    disabled={busy}
                    onChange={(e) =>
                      setFapd((f) => ({
                        ...f,
                        papelEstrategico: e.target.value as '' | PapelFapd,
                      }))
                    }
                  >
                    <option value="">Não definido</option>
                    <option value="estruturante">Estruturante</option>
                    <option value="gerador">Gerador</option>
                  </select>
                </label>
                <label className="fapd-field">
                  <span>Comentário</span>
                  <textarea
                    rows={3}
                    disabled={busy}
                    value={fapd.comentarioFapd}
                    onChange={(e) =>
                      setFapd((f) => ({
                        ...f,
                        comentarioFapd: e.target.value,
                      }))
                    }
                    placeholder="Observações da avaliação…"
                  />
                </label>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy || !selectedId}
                  onClick={() => void saveAvaliacaoFapd()}
                >
                  Salvar avaliação
                </button>
              </div>

              <div className="fapd-block">
                <h3>Decisão go / no-go</h3>
                <p className="muted fapd-lead">
                  Aprova para execução no portfólio ou reprova com justificativa
                  (projeto permanece no histórico como arquivado).
                </p>
                <label className="fapd-field">
                  <span>Justificativa</span>
                  <textarea
                    rows={2}
                    disabled={busy}
                    value={goNoGoJustificativa}
                    onChange={(e) => setGoNoGoJustificativa(e.target.value)}
                    placeholder="Obrigatória na reprovação"
                  />
                </label>
                <div className="actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || !selectedId}
                    onClick={() => void decidirProjeto('aprovado')}
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={busy || !selectedId}
                    onClick={() => void decidirProjeto('reprovado')}
                  >
                    Reprovar
                  </button>
                </div>
                {detail?.justificativaDecisao && (
                  <p className="muted" style={{ marginTop: 8 }}>
                    Última justificativa: {detail.justificativaDecisao}
                  </p>
                )}
              </div>

              {(detail?.acompanhamentoPosPendente ||
                selected?.status === 'encerrado') && (
                <div className="fapd-block">
                  <h3>Pós-projeto · ganhos</h3>
                  <p className="muted fapd-lead">
                    Projeto encerrado. Rode o Wizard de realização e acompanhe
                    os ganhos na janela pós-implantação.
                  </p>
                  <div className="actions">
                    <button
                      type="button"
                      className="btn"
                      disabled={!selectedId}
                      onClick={() => selectedId && onOpenWizard(selectedId)}
                    >
                      Wizard pós-entrega
                    </button>
                    {detail?.acompanhamentoPosPendente && (
                      <button
                        type="button"
                        className="btn secondary"
                        disabled={busy || !selectedId}
                        onClick={() => void marcarPosFeito()}
                      >
                        Marcar acompanhamento iniciado
                      </button>
                    )}
                  </div>
                </div>
              )}
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
