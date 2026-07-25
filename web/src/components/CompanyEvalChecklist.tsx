import { useMemo, useState } from "react";
import type { ChecklistItem, Coverage, Decisao, Roadmap } from "../lib/types";
import {
  COVERAGE,
  DECISAO,
  PILLAR_NAMES,
  ROADMAP,
  pct,
} from "../lib/types";
import {
  type UserCompany,
  MAT_OPTS,
  PORTE_OPTS,
  REGIAO_OPTS,
  SETORES_OPTS,
  blankCompany,
  companyCoverageStats,
  defaultItemEval,
  nextUserCompanyId,
} from "../lib/companyEval";
import type { MockEmpresa } from "../lib/mock";

export function CompanyEvalChecklist({
  items,
  companies,
  catalog,
  activeId,
  onSelect,
  onSaveCompanies,
  onRequestSync,
  mockEmpresas,
  onCloneMock,
  onCreated,
}: {
  items: ChecklistItem[];
  companies: UserCompany[];
  /** Todas as empresas da base (seed + locais) para seleção. */
  catalog: MockEmpresa[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onSaveCompanies: (next: UserCompany[]) => void;
  onRequestSync: () => void;
  mockEmpresas: MockEmpresa[];
  onCloneMock: (mockId: string) => void;
  onCreated: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    setor: "Indústria",
    porte: "Média",
    regiao: "Sudeste",
    uf: "SP",
    maturidade: "emergente",
    funcionarios: "1000",
    faturamentoMiBrl: "500",
  });
  const [filterPilar, setFilterPilar] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [cloneId, setCloneId] = useState(mockEmpresas[0]?.id ?? "");

  const active = companies.find((c) => c.id === activeId) ?? null;
  const catalogActive = catalog.find((e) => e.id === activeId) ?? null;
  const stats = active ? companyCoverageStats(active, items) : null;

  const setorOptions = useMemo(() => {
    const extra = active?.setor && !SETORES_OPTS.includes(active.setor)
      ? [active.setor]
      : [];
    return [...extra, ...SETORES_OPTS];
  }, [active?.setor]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filterPilar !== "all") {
        const want =
          filterPilar === "sintese" ? "sintese" : Number(filterPilar);
        if (i.pilar !== want) return false;
      }
      if (filterTipo !== "all" && i.tipo !== filterTipo) return false;
      return true;
    });
  }, [items, filterPilar, filterTipo]);

  const pillars = ([1, 2, 3, 4, 5, 6, 7, "sintese"] as const).filter((p) =>
    filtered.some((i) => i.pilar === p)
  );

  function createCompany() {
    if (!form.nome.trim()) return;
    const company = blankCompany({
      id: nextUserCompanyId(companies),
      nome: form.nome.trim(),
      setor: form.setor,
      porte: form.porte,
      regiao: form.regiao,
      uf: form.uf.toUpperCase().slice(0, 2),
      maturidade: form.maturidade,
      funcionarios: Number(form.funcionarios) || 0,
      faturamentoMiBrl: Number(form.faturamentoMiBrl) || 0,
      source: "user",
      items: {},
    });
    onSaveCompanies([...companies, company]);
    onSelect(company.id);
    setShowForm(false);
    setForm((f) => ({ ...f, nome: "" }));
    onCreated(company.id);
  }

  function patchMeta(patch: Partial<UserCompany>) {
    if (!active) return;
    onSaveCompanies(
      companies.map((c) =>
        c.id === active.id
          ? { ...c, ...patch, updatedAt: new Date().toISOString() }
          : c
      )
    );
  }

  function patchItem(
    itemId: string,
    patch: Partial<ReturnType<typeof defaultItemEval>>
  ) {
    if (!active) return;
    const cur = active.items[itemId] ?? defaultItemEval();
    onSaveCompanies(
      companies.map((c) =>
        c.id === active.id
          ? {
              ...c,
              updatedAt: new Date().toISOString(),
              items: {
                ...c.items,
                [itemId]: { ...cur, ...patch },
              },
            }
          : c
      )
    );
  }

  function removeCompany() {
    if (!active) return;
    if (!confirm(`Remover ${active.nome} da base local?`)) return;
    const next = companies.filter((c) => c.id !== active.id);
    onSaveCompanies(next);
    onSelect(next[0]?.id ?? null);
  }

  return (
    <div className="company-eval">
      <div className="panel">
        <div className="company-eval-bar">
          <div>
            <label htmlFor="empresa-ativa">Empresa em avaliação</label>
            <select
              id="empresa-ativa"
              value={activeId ?? ""}
              onChange={(e) => onSelect(e.target.value || null)}
            >
              <option value="">— selecione —</option>
              {catalog.map((c) => {
                const local = companies.some((u) => u.id === c.id);
                return (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.id})
                    {local ? " · editável" : ""}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="toolbar-row" style={{ marginTop: 18 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? "Cancelar" : "+ Nova empresa"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={onRequestSync}
            >
              Sync Nao…
            </button>
            {active ? (
              <button type="button" className="btn ghost" onClick={removeCompany}>
                Remover
              </button>
            ) : null}
          </div>
        </div>

        <div className="clone-row">
          <label>Duplicar como nova (cópia)</label>
          <div className="clone-controls">
            <select
              value={cloneId}
              onChange={(e) => setCloneId(e.target.value)}
            >
              {mockEmpresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome} · {pct(e.coberturaMedia)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn"
              disabled={!cloneId}
              onClick={() => cloneId && onCloneMock(cloneId)}
            >
              Criar cópia
            </button>
          </div>
          <p className="muted tiny">
            Para editar uma empresa já cadastrada, selecione-a acima — os itens
            abrem prontos para alteração (sem precisar clonar).
          </p>
        </div>
      </div>

      {showForm ? (
        <div className="panel">
          <h3>Nova empresa</h3>
          <div className="filters empresas-filters">
            <div>
              <label>Nome *</label>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Acme Industrial"
              />
            </div>
            <div>
              <label>Setor</label>
              <select
                value={form.setor}
                onChange={(e) => setForm({ ...form, setor: e.target.value })}
              >
                {SETORES_OPTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Porte</label>
              <select
                value={form.porte}
                onChange={(e) => setForm({ ...form, porte: e.target.value })}
              >
                {PORTE_OPTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Região</label>
              <select
                value={form.regiao}
                onChange={(e) => setForm({ ...form, regiao: e.target.value })}
              >
                {REGIAO_OPTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>UF</label>
              <input
                value={form.uf}
                maxLength={2}
                onChange={(e) => setForm({ ...form, uf: e.target.value })}
              />
            </div>
            <div>
              <label>Maturidade IA</label>
              <select
                value={form.maturidade}
                onChange={(e) =>
                  setForm({ ...form, maturidade: e.target.value })
                }
              >
                {MAT_OPTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Funcionários</label>
              <input
                type="number"
                value={form.funcionarios}
                onChange={(e) =>
                  setForm({ ...form, funcionarios: e.target.value })
                }
              />
            </div>
            <div>
              <label>Faturamento (R$ mi)</label>
              <input
                type="number"
                value={form.faturamentoMiBrl}
                onChange={(e) =>
                  setForm({ ...form, faturamentoMiBrl: e.target.value })
                }
              />
            </div>
          </div>
          <div className="toolbar-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={createCompany}
              disabled={!form.nome.trim()}
            >
              Criar e avaliar
            </button>
          </div>
        </div>
      ) : null}

      {!activeId ? (
        <div className="panel">
          <p className="muted">
            Selecione uma empresa já cadastrada para editar os itens, ou crie
            uma nova. Depois confira em <strong>2. Empresas</strong> e use{" "}
            <strong>Sync Nao</strong> para enviar a base ao DuckDB.
          </p>
        </div>
      ) : !active ? (
        <div className="panel">
          <p className="muted">
            Preparando {catalogActive?.nome ?? activeId} para edição…
          </p>
        </div>
      ) : (
        <>
          <div className="panel">
            <div className="filters empresas-filters">
              <div>
                <label>Nome</label>
                <input
                  value={active.nome}
                  onChange={(e) => patchMeta({ nome: e.target.value })}
                />
              </div>
              <div>
                <label>Setor</label>
                <select
                  value={active.setor}
                  onChange={(e) => patchMeta({ setor: e.target.value })}
                >
                  {setorOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Maturidade</label>
                <select
                  value={active.maturidade}
                  onChange={(e) => patchMeta({ maturidade: e.target.value })}
                >
                  {MAT_OPTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Porte</label>
                <select
                  value={active.porte}
                  onChange={(e) => patchMeta({ porte: e.target.value })}
                >
                  {PORTE_OPTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {stats ? (
            <div className="stats">
              <div className="stat">
                <strong>{pct(stats.coberturaMedia)}</strong>
                <span>Cobertura</span>
              </div>
              <div className="stat">
                <strong>{stats.itensTem}</strong>
                <span>Tem</span>
              </div>
              <div className="stat">
                <strong>{stats.itensParcial}</strong>
                <span>Parcial</span>
              </div>
              <div className="stat">
                <strong>{stats.itensNaoTem}</strong>
                <span>Não tem</span>
              </div>
            </div>
          ) : null}

          <div className="panel">
            <div className="filters">
              <div>
                <label>Pilar</label>
                <select
                  value={filterPilar}
                  onChange={(e) => setFilterPilar(e.target.value)}
                >
                  <option value="all">Todos</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                    <option key={p} value={String(p)}>
                      P{p} {PILLAR_NAMES[String(p)]}
                    </option>
                  ))}
                  <option value="sintese">Síntese</option>
                </select>
              </div>
              <div>
                <label>Tipo</label>
                <select
                  value={filterTipo}
                  onChange={(e) => setFilterTipo(e.target.value)}
                >
                  <option value="all">Todos</option>
                  <option value="Expectativa">Expectativa</option>
                  <option value="Avançado">Avançado</option>
                  <option value="Inventario">Inventário</option>
                </select>
              </div>
            </div>
          </div>

          {pillars.map((p) => {
            const rows = filtered.filter((i) => i.pilar === p);
            const title =
              p === "sintese"
                ? `Síntese — ${PILLAR_NAMES.sintese}`
                : `Pilar ${p} — ${PILLAR_NAMES[String(p)]}`;

            return (
              <section key={String(p)} className="section">
                <h2>{title}</h2>
                <div className="eval-stack">
                  {rows.map((i) => {
                    const st = active.items[i.id] ?? defaultItemEval();
                    const isSintese = p === "sintese";
                    return (
                      <div key={i.id} className="eval-row eval-row-edit">
                        <div className="id">{i.id}</div>
                        <div className="eval-row-text">
                          {i.texto}
                          {!isSintese ? (
                            <div className="emp-meta">
                              <span className="badge">{i.tipo}</span>
                            </div>
                          ) : null}
                        </div>
                        <div className="eval-row-meta eval-row-controls">
                          {!isSintese ? (
                            <label className="eval-field">
                              <span>Cobertura</span>
                              <select
                                value={st.cobertura}
                                onChange={(e) =>
                                  patchItem(i.id, {
                                    cobertura: e.target.value as Coverage,
                                  })
                                }
                              >
                                {COVERAGE.map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : (
                            <label className="eval-field eval-field-wide">
                              <span>Resposta</span>
                              <input
                                value={st.resposta ?? ""}
                                onChange={(e) =>
                                  patchItem(i.id, {
                                    resposta: e.target.value,
                                  })
                                }
                              />
                            </label>
                          )}
                          <label className="eval-field">
                            <span>Roadmap</span>
                            <select
                              value={st.roadmap}
                              onChange={(e) =>
                                patchItem(i.id, {
                                  roadmap: e.target.value as Roadmap,
                                })
                              }
                            >
                              {ROADMAP.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="eval-field">
                            <span>Decisão</span>
                            <select
                              value={st.decisao}
                              onChange={(e) =>
                                patchItem(i.id, {
                                  decisao: e.target.value as Decisao,
                                })
                              }
                            >
                              {DECISAO.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <details className="eval-comment">
                          <summary>
                            {st.comentario?.trim()
                              ? "Comentário / justificativa"
                              : "Adicionar comentário"}
                          </summary>
                          <textarea
                            value={st.comentario ?? ""}
                            placeholder="Explique por que Cobertura / Roadmap / Decisão foram marcados assim…"
                            onChange={(e) =>
                              patchItem(i.id, {
                                comentario: e.target.value,
                              })
                            }
                          />
                        </details>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
