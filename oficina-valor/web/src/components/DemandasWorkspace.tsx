import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

type Demanda = {
  id: string;
  titulo: string;
  descricao: string;
  solicitanteNome: string;
  areaNome: string;
  origem: 'interna' | 'aevo';
  idAevo?: string | null;
  status: string;
  entrevistaConcluida?: boolean;
  entrevistaDispensaJustificativa?: string | null;
  ganhosEstimadosResumo?: string | null;
  scoreImpacto?: number | null;
  scoreAlinhamento?: number | null;
  scoreEsforco?: number | null;
  scoreRisco?: number | null;
  scoreTotal?: number | string | null;
  justificativaPriorizacao?: string | null;
  desenvolvimentoInterno?: boolean | null;
  investimentoEstimado?: number | string | null;
  decisaoGoNoGo?: string | null;
  justificativaDecisao?: string | null;
  projetoId?: string | null;
  projeto?: { id: string; nome: string; status: string } | null;
  createdAt?: string;
};

const COLUMNS: { id: string; label: string }[] = [
  { id: 'recebida', label: 'Recebida' },
  { id: 'entrevista', label: 'Entrevista' },
  { id: 'ficha', label: 'Ficha' },
  { id: 'priorizacao', label: 'Priorização' },
  { id: 'decisao', label: 'Decisão' },
  { id: 'aprovada', label: 'Aprovada' },
  { id: 'reprovada', label: 'Reprovada' },
];

const AREAS = ['Produção', 'Manutenção', 'Supply Chain', 'TI', 'Qualidade', 'Geral'];

function daysWaiting(createdAt?: string) {
  if (!createdAt) return '—';
  const d = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  return `${Math.max(0, d)}d`;
}

export function DemandasWorkspace({
  onMessage,
  onError,
  onOpenProjeto,
  onOpenWizard,
}: {
  onMessage: (m: string) => void;
  onError: (m: string) => void;
  onOpenProjeto?: (id: string) => void;
  onOpenWizard?: () => void;
}) {
  const [items, setItems] = useState<Demanda[]>([]);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [origemFilter, setOrigemFilter] = useState<'all' | 'interna' | 'aevo'>(
    'all',
  );
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    solicitanteNome: '',
    areaNome: 'Produção',
    origem: 'interna' as 'interna' | 'aevo',
    idAevo: '',
  });
  const [entrevista, setEntrevista] = useState({
    ganhos: '',
    dispensa: '',
  });
  const [prio, setPrio] = useState({
    impacto: '4',
    alinhamento: '4',
    esforco: '3',
    risco: '2',
    justificativa: '',
  });
  const [decisao, setDecisao] = useState({
    go: 'aprovado' as 'aprovado' | 'reprovado',
    interno: true,
    investimento: '',
    justificativa: '',
  });

  const selected = useMemo(
    () => items.find((d) => d.id === selectedId) || null,
    [items, selectedId],
  );

  async function refresh() {
    const list = await api.demandas(
      origemFilter === 'all' ? undefined : origemFilter,
    );
    setItems(list);
    if (selectedId && !list.some((d: Demanda) => d.id === selectedId)) {
      setSelectedId(null);
    }
  }

  useEffect(() => {
    setBusy(true);
    refresh()
      .catch((e) => onError(e.message || String(e)))
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origemFilter]);

  const byStatus = useMemo(() => {
    const map: Record<string, Demanda[]> = {};
    for (const c of COLUMNS) map[c.id] = [];
    for (const d of items) {
      const key = map[d.status] ? d.status : 'recebida';
      map[key].push(d);
    }
    return map;
  }, [items]);

  async function createDemanda(e: FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim() || !form.descricao.trim()) {
      onError('Informe título e descrição');
      return;
    }
    setBusy(true);
    try {
      const created = await api.criarDemanda({
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        solicitanteNome: form.solicitanteNome.trim() || 'Solicitante',
        areaNome: form.areaNome,
        origem: form.origem,
        idAevo: form.origem === 'aevo' ? form.idAevo.trim() : null,
      });
      setShowCreate(false);
      setForm({
        titulo: '',
        descricao: '',
        solicitanteNome: '',
        areaNome: 'Produção',
        origem: 'interna',
        idAevo: '',
      });
      await refresh();
      setSelectedId(created.id);
      onMessage('Demanda registrada no funil');
    } catch (err: any) {
      onError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function move(status: string) {
    if (!selectedId) return;
    setBusy(true);
    try {
      await api.atualizarStatusDemanda(selectedId, status);
      await refresh();
      onMessage(`Demanda movida para ${status}`);
    } catch (err: any) {
      onError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveEntrevista(dispensa = false) {
    if (!selectedId) return;
    setBusy(true);
    try {
      await api.entrevistaDemanda(selectedId, {
        ganhosEstimadosResumo: dispensa ? null : entrevista.ganhos.trim() || null,
        dispensaJustificativa: dispensa
          ? entrevista.dispensa.trim() || 'Dispensa registrada'
          : null,
      });
      await refresh();
      onMessage(dispensa ? 'Entrevista dispensada' : 'Entrevista registrada');
      onOpenWizard?.();
    } catch (err: any) {
      onError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function savePrio() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await api.priorizarDemanda(selectedId, {
        scoreImpacto: Number(prio.impacto),
        scoreAlinhamento: Number(prio.alinhamento),
        scoreEsforco: Number(prio.esforco),
        scoreRisco: Number(prio.risco),
        justificativaPriorizacao: prio.justificativa.trim() || null,
      });
      await refresh();
      onMessage('Priorização salva');
    } catch (err: any) {
      onError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveDecisao() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await api.decidirDemanda(selectedId, {
        decisao: decisao.go,
        justificativa: decisao.justificativa.trim() || null,
        desenvolvimentoInterno: decisao.interno,
        investimentoEstimado: decisao.interno
          ? null
          : Number(decisao.investimento) || null,
      });
      await refresh();
      onMessage(
        decisao.go === 'aprovado' ? 'Demanda aprovada' : 'Demanda reprovada',
      );
    } catch (err: any) {
      onError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function criarProjeto() {
    if (!selectedId) return;
    setBusy(true);
    try {
      const updated = await api.criarProjetoDaDemanda(selectedId);
      await refresh();
      onMessage('Projeto criado a partir da demanda');
      if (updated.projetoId) onOpenProjeto?.(updated.projetoId);
    } catch (err: any) {
      onError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="demandas">
      <div className="panel-head" style={{ marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Demandas · funil VMO</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Captação → entrevista de ganhos → priorização → go/no-go → projeto
          </p>
        </div>
        <div className="top-actions">
          <select
            value={origemFilter}
            onChange={(e) => setOrigemFilter(e.target.value as any)}
            disabled={busy}
          >
            <option value="all">Todas origens</option>
            <option value="interna">Interna</option>
            <option value="aevo">AEVO</option>
          </select>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => setShowCreate((v) => !v)}
          >
            + Oportunidade
          </button>
        </div>
      </div>

      {showCreate && (
        <form className="panel flat" onSubmit={createDemanda} style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Registrar oportunidade</h3>
          <div className="form-grid">
            <label className="field">
              <span>Título</span>
              <input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>Solicitante</span>
              <input
                value={form.solicitanteNome}
                onChange={(e) =>
                  setForm((f) => ({ ...f, solicitanteNome: e.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Área</span>
              <select
                value={form.areaNome}
                onChange={(e) => setForm((f) => ({ ...f, areaNome: e.target.value }))}
              >
                {AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Origem</span>
              <select
                value={form.origem}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    origem: e.target.value as 'interna' | 'aevo',
                  }))
                }
              >
                <option value="interna">Interna</option>
                <option value="aevo">AEVO (ID manual)</option>
              </select>
            </label>
            {form.origem === 'aevo' && (
              <label className="field">
                <span>ID AEVO</span>
                <input
                  value={form.idAevo}
                  onChange={(e) => setForm((f) => ({ ...f, idAevo: e.target.value }))}
                  placeholder="AEVO-2026-0001"
                />
              </label>
            )}
          </div>
          <label className="field">
            <span>Descrição da dor/oportunidade</span>
            <textarea
              rows={3}
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            />
          </label>
          <div className="actions">
            <button type="submit" className="btn" disabled={busy}>
              Salvar no funil
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setShowCreate(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="demandas-board">
        {COLUMNS.map((col) => (
          <section key={col.id} className="demandas-col">
            <header>
              <strong>{col.label}</strong>
              <span className="muted">{byStatus[col.id]?.length || 0}</span>
            </header>
            <div className="demandas-cards">
              {(byStatus[col.id] || []).map((d) => (
                <button
                  type="button"
                  key={d.id}
                  className={`demanda-card ${selectedId === d.id ? 'active' : ''}`}
                  onClick={() => setSelectedId(d.id)}
                >
                  <strong>{d.titulo}</strong>
                  <span className="muted">
                    {d.origem.toUpperCase()}
                    {d.idAevo ? ` · ${d.idAevo}` : ''} · {d.areaNome}
                  </span>
                  <span className="muted">
                    {daysWaiting(d.createdAt)} · score{' '}
                    {d.scoreTotal != null ? Number(d.scoreTotal).toFixed(1) : '—'}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {selected && (
        <aside className="panel demandas-detail">
          <div className="panel-head">
            <div>
              <h3 style={{ margin: 0 }}>{selected.titulo}</h3>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                {selected.solicitanteNome} · {selected.areaNome} ·{' '}
                {selected.origem}
                {selected.idAevo ? ` (${selected.idAevo})` : ''}
              </p>
            </div>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setSelectedId(null)}
            >
              Fechar
            </button>
          </div>
          <p>{selected.descricao}</p>

          <div className="actions" style={{ flexWrap: 'wrap' }}>
            {COLUMNS.filter((c) =>
              ['recebida', 'entrevista', 'ficha', 'priorizacao', 'decisao'].includes(
                c.id,
              ),
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                className="btn secondary"
                disabled={busy || selected.status === c.id}
                onClick={() => void move(c.id)}
              >
                → {c.label}
              </button>
            ))}
          </div>

          <div className="fapd-block">
            <h3>Entrevista de ganhos</h3>
            <p className="muted fapd-lead">
              Registre o entendimento de ganhos (ou dispense) antes da ficha.
              Use o Wizard de ganhos para aprofundar.
            </p>
            <label className="fapd-field">
              <span>Resumo dos ganhos estimados</span>
              <textarea
                rows={3}
                value={entrevista.ganhos}
                onChange={(e) =>
                  setEntrevista((x) => ({ ...x, ganhos: e.target.value }))
                }
                placeholder="Hard/soft estimados, premissas…"
              />
            </label>
            <label className="fapd-field">
              <span>Justificativa de dispensa (se houver)</span>
              <input
                value={entrevista.dispensa}
                onChange={(e) =>
                  setEntrevista((x) => ({ ...x, dispensa: e.target.value }))
                }
              />
            </label>
            <div className="actions">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void saveEntrevista(false)}
              >
                Concluir entrevista
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() => void saveEntrevista(true)}
              >
                Dispensar
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() => onOpenWizard?.()}
              >
                Abrir Wizard
              </button>
            </div>
            {(selected.entrevistaConcluida ||
              selected.entrevistaDispensaJustificativa) && (
              <p className="ok" style={{ marginTop: 8 }}>
                Entrevista{' '}
                {selected.entrevistaConcluida ? 'concluída' : 'dispensada'}
                {selected.ganhosEstimadosResumo
                  ? ` · ${selected.ganhosEstimadosResumo}`
                  : ''}
              </p>
            )}
          </div>

          <div className="fapd-block">
            <h3>Priorização (1–5)</h3>
            <div className="form-grid">
              {(
                [
                  ['impacto', 'Impacto financeiro'],
                  ['alinhamento', 'Alinhamento OE'],
                  ['esforco', 'Esforço'],
                  ['risco', 'Risco'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="field">
                  <span>{label}</span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={(prio as any)[key]}
                    onChange={(e) =>
                      setPrio((p) => ({ ...p, [key]: e.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
            <label className="fapd-field">
              <span>Justificativa</span>
              <textarea
                rows={2}
                value={prio.justificativa}
                onChange={(e) =>
                  setPrio((p) => ({ ...p, justificativa: e.target.value }))
                }
              />
            </label>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void savePrio()}
            >
              Salvar priorização
            </button>
            {selected.scoreTotal != null && (
              <p className="muted" style={{ marginTop: 8 }}>
                Score atual: {Number(selected.scoreTotal).toFixed(2)}
              </p>
            )}
          </div>

          <div className="fapd-block">
            <h3>Decisão go / no-go</h3>
            <div className="form-grid">
              <label className="field">
                <span>Decisão</span>
                <select
                  value={decisao.go}
                  onChange={(e) =>
                    setDecisao((d) => ({
                      ...d,
                      go: e.target.value as 'aprovado' | 'reprovado',
                    }))
                  }
                >
                  <option value="aprovado">Aprovado</option>
                  <option value="reprovado">Reprovado</option>
                </select>
              </label>
              <label className="field">
                <span>Desenvolvimento interno?</span>
                <select
                  value={decisao.interno ? 'sim' : 'nao'}
                  onChange={(e) =>
                    setDecisao((d) => ({
                      ...d,
                      interno: e.target.value === 'sim',
                    }))
                  }
                >
                  <option value="sim">Sim</option>
                  <option value="nao">Não (exige investimento)</option>
                </select>
              </label>
              {!decisao.interno && (
                <label className="field">
                  <span>Investimento estimado (R$)</span>
                  <input
                    type="number"
                    min={0}
                    value={decisao.investimento}
                    onChange={(e) =>
                      setDecisao((d) => ({
                        ...d,
                        investimento: e.target.value,
                      }))
                    }
                  />
                </label>
              )}
            </div>
            <label className="fapd-field">
              <span>Justificativa</span>
              <textarea
                rows={2}
                value={decisao.justificativa}
                onChange={(e) =>
                  setDecisao((d) => ({ ...d, justificativa: e.target.value }))
                }
                placeholder="Obrigatória se reprovado"
              />
            </label>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void saveDecisao()}
            >
              Registrar decisão
            </button>
          </div>

          <div className="actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn"
              disabled={busy || !!selected.projetoId}
              onClick={() => void criarProjeto()}
            >
              {selected.projetoId ? 'Projeto já vinculado' : 'Criar projeto / ficha'}
            </button>
            {selected.projetoId && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => onOpenProjeto?.(selected.projetoId!)}
              >
                Abrir projeto
              </button>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
