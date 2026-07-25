import { useEffect, useMemo, useState } from "react";
import {
  type MockAvaliacao,
  type MockDataset,
  type MockEmpresa,
  coberturaBarColor,
  formatFat,
} from "../lib/mock";
import type { CompanyItemEval } from "../lib/companyEval";
import {
  COVERAGE,
  DECISAO,
  PILLAR_NAMES,
  ROADMAP,
  type Coverage,
  type Decisao,
  type Roadmap,
  pct,
} from "../lib/types";

function cobClass(c: string) {
  if (c === "Tem") return "cob-tem";
  if (c === "Parcial") return "cob-parcial";
  if (c === "Não tem") return "cob-nao";
  return "cob-vazio";
}

export function CompaniesPanel({
  dataset,
  highlightId,
  selectedId: controlledSelected,
  onSelectCompany,
  onEditCompany,
  onPatchEval,
  onRequestSync,
  dirty,
}: {
  dataset: MockDataset;
  highlightId?: string | null;
  selectedId?: string | null;
  onSelectCompany?: (id: string) => void;
  onEditCompany?: (id: string) => void;
  onPatchEval?: (
    companyId: string,
    itemId: string,
    patch: Partial<CompanyItemEval>
  ) => void;
  onRequestSync?: () => void;
  dirty?: boolean;
}) {
  const DATA = dataset;
  const [q, setQ] = useState("");
  const [setor, setSetor] = useState("all");
  const [maturidade, setMaturidade] = useState("all");
  const [porte, setPorte] = useState("all");
  const [regiao, setRegiao] = useState("all");
  const [sort, setSort] = useState<"cobertura" | "nome" | "faturamento">(
    "cobertura"
  );
  const [onlyMine, setOnlyMine] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    controlledSelected ?? DATA.empresas[0]?.id ?? null
  );
  const [filterCob, setFilterCob] = useState("all");
  const [filterPilar, setFilterPilar] = useState("all");

  useEffect(() => {
    if (controlledSelected) setSelectedId(controlledSelected);
  }, [controlledSelected]);

  useEffect(() => {
    if (!selectedId || !DATA.empresas.some((e) => e.id === selectedId)) {
      setSelectedId(DATA.empresas[0]?.id ?? null);
    }
  }, [DATA.empresas, selectedId]);

  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`emp-row-${highlightId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId]);

  const userAdded = DATA.empresas.filter((e) => e.id.startsWith("u")).length;

  const setores = useMemo(
    () => [...new Set(DATA.empresas.map((e) => e.setor))].sort(),
    [DATA.empresas]
  );
  const regioes = useMemo(
    () => [...new Set(DATA.empresas.map((e) => e.regiao))].sort(),
    [DATA.empresas]
  );
  const portes = useMemo(
    () => [...new Set(DATA.empresas.map((e) => e.porte))].sort(),
    [DATA.empresas]
  );
  const mats = useMemo(
    () => [...new Set(DATA.empresas.map((e) => e.maturidade))],
    [DATA.empresas]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = DATA.empresas.filter((e) => {
      if (onlyMine && !e.id.startsWith("u")) return false;
      if (setor !== "all" && e.setor !== setor) return false;
      if (maturidade !== "all" && e.maturidade !== maturidade) return false;
      if (porte !== "all" && e.porte !== porte) return false;
      if (regiao !== "all" && e.regiao !== regiao) return false;
      if (!needle) return true;
      return (
        e.nome.toLowerCase().includes(needle) ||
        e.id.toLowerCase().includes(needle) ||
        e.setor.toLowerCase().includes(needle)
      );
    });
    list = [...list].sort((a, b) => {
      if (sort === "nome") return a.nome.localeCompare(b.nome, "pt-BR");
      if (sort === "faturamento") return b.faturamentoMiBrl - a.faturamentoMiBrl;
      return b.coberturaMedia - a.coberturaMedia;
    });
    return list;
  }, [DATA.empresas, q, setor, maturidade, porte, regiao, sort, onlyMine]);

  const selected: MockEmpresa | null =
    DATA.empresas.find((e) => e.id === selectedId) ?? filtered[0] ?? null;

  const avaliacoes: MockAvaliacao[] = selected
    ? DATA.avaliacoes[selected.id] ?? []
    : [];

  const avFiltered = avaliacoes.filter((a) => {
    if (filterCob !== "all" && a.cobertura !== filterCob) return false;
    if (filterPilar !== "all") {
      const want =
        filterPilar === "sintese" ? "sintese" : Number(filterPilar);
      if (a.pilar !== want) return false;
    }
    return true;
  });

  const byPilar = useMemo(() => {
    const map = new Map<string, MockAvaliacao[]>();
    for (const a of avFiltered) {
      const key = String(a.pilar);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0] === "sintese") return 1;
      if (b[0] === "sintese") return -1;
      return Number(a[0]) - Number(b[0]);
    });
  }, [avFiltered]);

  const avgCob =
    DATA.empresas.reduce((s, e) => s + e.coberturaMedia, 0) /
    (DATA.empresas.length || 1);

  return (
    <div className="empresas">
      <div className="panel hero-ai">
        <p className="eyebrow">
          Passo 2 · Base viva · {DATA.empresas.length} empresas
          {userAdded ? ` · ${userAdded} suas` : ""}
          {dirty ? " · sync pendente" : ""}
        </p>
        <h2>Empresas e avaliações</h2>
        <p>
          Base de pesquisa + alterações locais. Edite Cobertura / Roadmap /
          Decisão / comentário direto nos itens, ou abra no Avaliar.
        </p>
        <div className="toolbar-row">
          <button
            type="button"
            className={onlyMine ? "btn btn-primary" : "btn"}
            onClick={() => setOnlyMine((v) => !v)}
          >
            {onlyMine ? "Mostrando só suas" : "Filtrar só suas"}
          </button>
          {onRequestSync ? (
            <button type="button" className="btn" onClick={onRequestSync}>
              Sync Nao…
            </button>
          ) : null}
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <strong>{DATA.empresas.length}</strong>
          <span>Empresas</span>
        </div>
        <div className="stat">
          <strong>{pct(avgCob)}</strong>
          <span>Cobertura média</span>
        </div>
        <div className="stat">
          <strong>{setores.length}</strong>
          <span>Setores</span>
        </div>
        <div className="stat">
          <strong>{filtered.length}</strong>
          <span>Filtradas</span>
        </div>
      </div>

      <div className="panel">
        <div className="filters empresas-filters">
          <div>
            <label>Busca</label>
            <input
              placeholder="Nome, ID, setor…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <label>Setor</label>
            <select value={setor} onChange={(e) => setSetor(e.target.value)}>
              <option value="all">Todos</option>
              {setores.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Maturidade</label>
            <select
              value={maturidade}
              onChange={(e) => setMaturidade(e.target.value)}
            >
              <option value="all">Todas</option>
              {mats.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Porte</label>
            <select value={porte} onChange={(e) => setPorte(e.target.value)}>
              <option value="all">Todos</option>
              {portes.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Região</label>
            <select value={regiao} onChange={(e) => setRegiao(e.target.value)}>
              <option value="all">Todas</option>
              {regioes.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Ordenar</label>
            <select
              value={sort}
              onChange={(e) =>
                setSort(e.target.value as "cobertura" | "nome" | "faturamento")
              }
            >
              <option value="cobertura">Cobertura</option>
              <option value="nome">Nome</option>
              <option value="faturamento">Faturamento</option>
            </select>
          </div>
        </div>
      </div>

      <div className="empresas-layout">
        <div className="panel empresas-list-panel">
          <h3>Lista ({filtered.length})</h3>
          <div className="table-wrap empresas-table-wrap">
            <table className="empresas-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Setor</th>
                  <th>Mat.</th>
                  <th>Cobertura</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const isMine = e.id.startsWith("u");
                  return (
                  <tr
                    key={e.id}
                    id={`emp-row-${e.id}`}
                    className={[
                      selected?.id === e.id ? "row-selected" : "",
                      highlightId === e.id ? "row-flash" : "",
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined}
                    onClick={() => {
                      setSelectedId(e.id);
                      onSelectCompany?.(e.id);
                    }}
                  >
                    <td>
                      <div className="emp-name">
                        {e.nome}{" "}
                        <span
                          className={`mat-pill ${isMine ? "badge-sua" : "badge-pesquisa"}`}
                        >
                          {isMine ? "Sua" : "Pesquisa"}
                        </span>
                      </div>
                      <div className="emp-meta">
                        {e.id} · {e.porte} · {e.regiao}
                      </div>
                    </td>
                    <td>{e.setor}</td>
                    <td>
                      <span className={`mat-pill mat-${slug(e.maturidade)}`}>
                        {e.maturidade}
                      </span>
                    </td>
                    <td>
                      <div className="cob-cell">
                        <span>{pct(e.coberturaMedia)}</span>
                        <div className="heat-track">
                          <div
                            className="heat-fill"
                            style={{
                              width: `${Math.min(100, e.coberturaMedia * 100)}%`,
                              background: coberturaBarColor(e.coberturaMedia),
                            }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="empresas-detail">
          {selected ? (
            <>
              <div className="panel">
                <p className="eyebrow">{selected.id}</p>
                <h3>{selected.nome}</h3>
                <p className="muted">
                  {selected.setor} · {selected.porte} · {selected.regiao}/
                  {selected.uf} · {selected.funcionarios.toLocaleString("pt-BR")}{" "}
                  func. · {formatFat(selected.faturamentoMiBrl)} · maturidade{" "}
                  <strong>{selected.maturidade}</strong>
                </p>
                <div className="stats compact-stats">
                  <div className="stat">
                    <strong>{pct(selected.coberturaMedia)}</strong>
                    <span>Cobertura</span>
                  </div>
                  <div className="stat">
                    <strong>{selected.itensTem}</strong>
                    <span>Tem</span>
                  </div>
                  <div className="stat">
                    <strong>{selected.itensParcial}</strong>
                    <span>Parcial</span>
                  </div>
                  <div className="stat">
                    <strong>{selected.itensNaoTem}</strong>
                    <span>Não tem</span>
                  </div>
                </div>
                <p className="muted tiny">
                  Decisões: Comprar {selected.decisaoComprar} · Construir{" "}
                  {selected.decisaoConstruir} · Híbrido{" "}
                  {selected.decisaoHibrido}
                </p>
                <div className="toolbar-row">
                  {onEditCompany ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => onEditCompany(selected.id)}
                    >
                      Abrir no Avaliar
                    </button>
                  ) : null}
                </div>
                {onPatchEval ? (
                  <p className="muted tiny">
                    Itens abaixo são editáveis — a primeira alteração grava
                    override local (mesmo ID).
                  </p>
                ) : null}
              </div>

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
                    <label>Cobertura</label>
                    <select
                      value={filterCob}
                      onChange={(e) => setFilterCob(e.target.value)}
                    >
                      <option value="all">Todas</option>
                      <option value="Tem">Tem</option>
                      <option value="Parcial">Parcial</option>
                      <option value="Não tem">Não tem</option>
                      <option value="—">—</option>
                    </select>
                  </div>
                </div>
              </div>

              {byPilar.map(([pilar, rows]) => {
                const title =
                  pilar === "sintese"
                    ? `Síntese — ${PILLAR_NAMES.sintese}`
                    : `Pilar ${pilar} — ${PILLAR_NAMES[pilar] ?? ""}`;
                return (
                  <section key={pilar} className="section">
                    <h2>
                      {title}{" "}
                      <span className="section-count">{rows.length}</span>
                    </h2>
                    <div className="eval-stack">
                      {rows.map((a) => (
                        <div
                          key={`${selected.id}-${a.itemId}`}
                          className="eval-row eval-row-edit"
                        >
                          <div className="id">{a.itemId}</div>
                          <div className="eval-row-text">
                            {a.texto}
                            {a.resposta ? (
                              <div className="emp-meta">{a.resposta}</div>
                            ) : null}
                          </div>
                          <div className="eval-row-meta eval-row-controls">
                            {onPatchEval ? (
                              <>
                                <label className="eval-field">
                                  <span>Cobertura</span>
                                  <select
                                    value={a.cobertura}
                                    onChange={(e) =>
                                      onPatchEval(selected.id, a.itemId, {
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
                                <label className="eval-field">
                                  <span>Roadmap</span>
                                  <select
                                    value={a.roadmap}
                                    onChange={(e) =>
                                      onPatchEval(selected.id, a.itemId, {
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
                                    value={a.decisao}
                                    onChange={(e) =>
                                      onPatchEval(selected.id, a.itemId, {
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
                              </>
                            ) : (
                              <>
                                <span
                                  className={`badge cob-badge ${cobClass(a.cobertura)}`}
                                >
                                  {a.cobertura}
                                </span>
                                <span className="eval-meta-chip">
                                  {a.roadmap}
                                </span>
                                <span className="eval-meta-chip">
                                  {a.decisao}
                                </span>
                              </>
                            )}
                          </div>
                          <details className="eval-comment">
                            <summary>
                              {a.comentario
                                ? "Por que essa nota"
                                : "Comentário"}
                            </summary>
                            {onPatchEval ? (
                              <textarea
                                value={a.comentario ?? ""}
                                placeholder="Justifique Cobertura / Roadmap / Decisão…"
                                onChange={(e) =>
                                  onPatchEval(selected.id, a.itemId, {
                                    comentario: e.target.value,
                                  })
                                }
                              />
                            ) : (
                              <p>
                                {a.comentario?.trim() ||
                                  "Sem justificativa registrada para este item."}
                              </p>
                            )}
                          </details>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </>
          ) : (
            <div className="panel">
              <p className="muted">Nenhuma empresa no filtro.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}
