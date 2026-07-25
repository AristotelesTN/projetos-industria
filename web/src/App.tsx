import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import rawItems from "./items.json";
import rawMock from "./data/mock-empresas.json";
import { CompanyEvalChecklist } from "./components/CompanyEvalChecklist";
import { NaoPanel } from "./components/NaoPanel";
import {
  downloadText,
  exportChecklistCsv,
  importChecklistCsv,
  mergeImportedState,
} from "./lib/csv";
import {
  type CompanyItemEval,
  type UserCompany,
  adoptMockToUser,
  cloneMockToUser,
  defaultItemEval,
  loadUserCompanies,
  mergeDataset,
  saveUserCompanies,
} from "./lib/companyEval";
import { buildNaoSyncPayload, downloadText as dl } from "./lib/naoSync";
import type { MockDataset } from "./lib/mock";
import {
  SyncConfirmDialog,
  SyncStatusPill,
} from "./components/SyncConfirmDialog";
import {
  fingerprintCompanies,
  loadSyncState,
  type SyncState,
} from "./lib/syncState";
import {
  type ChecklistItem,
  type ItemState,
  type TabId,
  type VendorId,
  COVERAGE,
  DECISAO,
  PILLAR_NAMES,
  ROADMAP,
  STORAGE_KEY,
  VENDORS,
  coveragePct,
  defaultState,
  isGap,
  pct,
} from "./lib/types";

const CompaniesPanel = lazy(() =>
  import("./components/CompaniesPanel").then((m) => ({
    default: m.CompaniesPanel,
  }))
);

const ITEMS = rawItems as ChecklistItem[];
const SEED = rawMock as MockDataset;

type ChecklistMode = "fornecedores" | "empresa";

type Persisted = {
  vendorNames: Record<VendorId, string>;
  itemState: Record<string, ItemState>;
};

function loadPersisted(): Persisted {
  const fallback: Persisted = {
    vendorNames: {
      v1: "Fornecedor A",
      v2: "Fornecedor B",
      v3: "Fornecedor C",
    },
    itemState: Object.fromEntries(ITEMS.map((i) => [i.id, defaultState()])),
  };
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem("plataforma-ia-industrial-checklist-v2") ||
      localStorage.getItem("plataforma-ia-industrial-checklist-v1");
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      vendorNames: parsed.vendorNames ?? fallback.vendorNames,
      itemState: parsed.itemState ?? fallback.itemState,
    };
  } catch {
    return fallback;
  }
}

export default function App() {
  const initial = useMemo(() => loadPersisted(), []);
  const [vendorNames, setVendorNames] = useState(initial.vendorNames);
  const [itemState, setItemState] = useState(initial.itemState);
  const [userCompanies, setUserCompanies] = useState<UserCompany[]>(() =>
    loadUserCompanies()
  );
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(
    () => loadUserCompanies()[0]?.id ?? null
  );
  const [checklistMode, setChecklistMode] =
    useState<ChecklistMode>("empresa");
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(() => loadSyncState());
  const [highlightCompanyId, setHighlightCompanyId] = useState<string | null>(
    null
  );
  const [tab, setTab] = useState<TabId>(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("tab");
      if (q === "nao" || q === "empresas" || q === "checklist") return q;
    } catch {
      /* ignore */
    }
    return "checklist";
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (tab === "checklist") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url);
  }, [tab]);
  const [showVendorMode, setShowVendorMode] = useState(false);
  const [filterPilar, setFilterPilar] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterDecisao, setFilterDecisao] = useState("all");
  const [filterGap, setFilterGap] = useState("all");
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const liveDataset = useMemo(
    () => mergeDataset(SEED, userCompanies, ITEMS),
    [userCompanies]
  );

  const dirty = useMemo(() => {
    const fp = fingerprintCompanies(userCompanies);
    if (!syncState.lastFingerprint) return userCompanies.length > 0;
    return fp !== syncState.lastFingerprint;
  }, [userCompanies, syncState.lastFingerprint]);

  function persist(next: Partial<Persisted>) {
    const payload: Persisted = {
      vendorNames: next.vendorNames ?? vendorNames,
      itemState: next.itemState ?? itemState,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function persistCompanies(next: UserCompany[]) {
    setUserCompanies(next);
    saveUserCompanies(next);
  }

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4200);
  }

  function openSync() {
    setSyncOpen(true);
  }

  function goToEmpresas(companyId: string) {
    setActiveCompanyId(companyId);
    setHighlightCompanyId(companyId);
    setTab("empresas");
    window.setTimeout(() => setHighlightCompanyId(null), 3500);
  }

  /** Garante empresa na base local editável (adota seed com o mesmo id). */
  function ensureEditable(companyId: string): void {
    setUserCompanies((prev) => {
      if (prev.some((c) => c.id === companyId)) return prev;
      const mock = SEED.empresas.find((e) => e.id === companyId);
      if (!mock) return prev;
      const adopted = adoptMockToUser(mock, SEED.avaliacoes[companyId] ?? []);
      const next = [...prev, adopted];
      saveUserCompanies(next);
      return next;
    });
  }

  function patchCompanyEval(
    companyId: string,
    itemId: string,
    patch: Partial<CompanyItemEval>
  ) {
    setUserCompanies((prev) => {
      let list = prev;
      let company = list.find((c) => c.id === companyId);
      if (!company) {
        const mock = SEED.empresas.find((e) => e.id === companyId);
        if (!mock) return prev;
        company = adoptMockToUser(mock, SEED.avaliacoes[companyId] ?? []);
        list = [...list, company];
      }
      const cur = company.items[itemId] ?? defaultItemEval();
      const updated: UserCompany = {
        ...company,
        updatedAt: new Date().toISOString(),
        items: {
          ...company.items,
          [itemId]: { ...cur, ...patch },
        },
      };
      const next = list.map((c) => (c.id === companyId ? updated : c));
      saveUserCompanies(next);
      return next;
    });
  }

  function editCompanyInChecklist(companyId: string) {
    ensureEditable(companyId);
    setActiveCompanyId(companyId);
    setChecklistMode("empresa");
    setShowVendorMode(false);
    setTab("checklist");
    flash(`Editando itens de ${companyId} — alterações ficam na base local.`);
  }

  function onCloneMock(mockId: string) {
    const mock = SEED.empresas.find((e) => e.id === mockId);
    if (!mock) return;
    const cloned = cloneMockToUser(
      mock,
      SEED.avaliacoes[mockId] ?? [],
      userCompanies
    );
    persistCompanies([...userCompanies, cloned]);
    setActiveCompanyId(cloned.id);
    flash(`${cloned.nome} pronta — continue a avaliação.`);
  }

  function onSelectCompanyForEval(id: string | null) {
    if (id) ensureEditable(id);
    setActiveCompanyId(id);
  }

  function setNames(next: typeof vendorNames) {
    setVendorNames(next);
    persist({ vendorNames: next });
  }

  function setStates(next: typeof itemState) {
    setItemState(next);
    persist({ itemState: next });
  }

  function patchItem(id: string, patch: Partial<ItemState>) {
    const cur = itemState[id] ?? defaultState();
    setStates({
      ...itemState,
      [id]: {
        ...cur,
        ...patch,
        coberturas: patch.coberturas
          ? { ...cur.coberturas, ...patch.coberturas }
          : cur.coberturas,
      },
    });
  }

  const platform = ITEMS.filter((i) => i.pilar !== "sintese");
  const scores = {
    v1: coveragePct(platform, itemState, "v1"),
    v2: coveragePct(platform, itemState, "v2"),
    v3: coveragePct(platform, itemState, "v3"),
  };
  const gaps = platform.filter((i) => isGap(itemState[i.id] ?? defaultState()));

  const filtered = ITEMS.filter((i) => {
    if (filterPilar !== "all") {
      const want = filterPilar === "sintese" ? "sintese" : Number(filterPilar);
      if (i.pilar !== want) return false;
    }
    if (filterTipo !== "all" && i.tipo !== filterTipo) return false;
    if (
      filterDecisao !== "all" &&
      (itemState[i.id] ?? defaultState()).decisao !== filterDecisao
    )
      return false;
    if (filterGap === "comum" && i.pilar !== "sintese") {
      if (!isGap(itemState[i.id] ?? defaultState())) return false;
    }
    return true;
  });

  const pillars = ([1, 2, 3, 4, 5, 6, 7, "sintese"] as const).filter((p) =>
    filtered.some((i) => i.pilar === p)
  );

  function onExport() {
    const stamp = new Date().toISOString().slice(0, 10);
    if (checklistMode === "empresa") {
      const pack = buildNaoSyncPayload(liveDataset, ITEMS);
      dl(`empresas-${stamp}.csv`, pack.empresasCsv);
      dl(`avaliacoes-${stamp}.csv`, pack.avaliacoesCsv);
      flash(
        `CSV da base exportado (${pack.meta.nEmpresas} empresas, ${pack.meta.nAvaliacoes} avaliações).`
      );
      return;
    }
    downloadText(
      `plataforma-ia-industrial-${stamp}.csv`,
      exportChecklistCsv(ITEMS, vendorNames, itemState)
    );
    flash("CSV de fornecedores exportado.");
  }

  function onImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const result = importChecklistCsv(text, ITEMS);
      if (result.updated === 0) {
        flash(result.errors[0] || "Nada importado.");
        return;
      }
      const merged = mergeImportedState(itemState, result.itemState, ITEMS);
      const names = {
        ...vendorNames,
        ...(result.vendorNames?.v1 ? { v1: result.vendorNames.v1 } : {}),
        ...(result.vendorNames?.v2 ? { v2: result.vendorNames.v2 } : {}),
        ...(result.vendorNames?.v3 ? { v3: result.vendorNames.v3 } : {}),
      };
      setVendorNames(names);
      setItemState(merged);
      persist({ vendorNames: names, itemState: merged });
      flash(`Importados ${result.updated} itens.`);
    };
    reader.readAsText(file, "UTF-8");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="mark" aria-hidden />
          <div>
            <p className="brand-kicker">Plataforma IA Industrial</p>
            <h1>Avaliação de empresas</h1>
          </div>
        </div>
        <div className="top-actions">
          <SyncStatusPill
            dirty={dirty}
            syncState={syncState}
            onClick={openSync}
          />
          {checklistMode === "fornecedores" && showVendorMode ? (
            <>
              <button type="button" className="btn" onClick={onExport}>
                Exportar CSV fornecedores
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => fileRef.current?.click()}
              >
                Importar CSV
              </button>
            </>
          ) : (
            <button type="button" className="btn" onClick={onExport}>
              Exportar base CSV
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={openSync}>
            Sync Nao
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </header>

      <nav className="tabs" aria-label="Seções">
        {(
          [
            ["checklist", "1. Avaliar"],
            ["empresas", "2. Empresas"],
            ["nao", "3. Nao"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "tab active" : "tab"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {toast ? <div className="toast">{toast}</div> : null}

      <SyncConfirmDialog
        open={syncOpen}
        onClose={() => setSyncOpen(false)}
        dataset={liveDataset}
        items={ITEMS}
        userCompanies={userCompanies}
        onDone={(msg, state) => {
          setSyncState(state);
          flash(msg);
        }}
      />

      {tab === "checklist" && (
        <>
          <div className="panel">
            <p className="muted tiny" style={{ margin: "0 0 10px" }}>
              {userCompanies.length} empresa(s) suas · {liveDataset.empresas.length}{" "}
              na base total (mock + suas)
              {dirty ? " · alterações ainda não enviadas ao Nao" : ""}.
            </p>
            <details
              className="advanced-vendor"
              open={showVendorMode}
              onToggle={(e) => {
                const open = (e.target as HTMLDetailsElement).open;
                setShowVendorMode(open);
                setChecklistMode(open ? "fornecedores" : "empresa");
              }}
            >
              <summary>Avançado: comparar 3 fornecedores (legado)</summary>
              <p className="muted tiny">
                Este modo não entra na base de Empresas nem no sync Nao. Use só
                para RFP lado a lado.
              </p>
            </details>
          </div>

          {!showVendorMode ? (
            <CompanyEvalChecklist
              items={ITEMS}
              companies={userCompanies}
              catalog={liveDataset.empresas}
              activeId={activeCompanyId}
              onSelect={onSelectCompanyForEval}
              onSaveCompanies={persistCompanies}
              onRequestSync={openSync}
              mockEmpresas={SEED.empresas}
              onCloneMock={onCloneMock}
              onCreated={goToEmpresas}
            />
          ) : (
            <>
          <div className="panel">
            <div className="grid-3">
              {VENDORS.map((v) => (
                <div key={v}>
                  <label htmlFor={v}>Fornecedor {v}</label>
                  <input
                    id={v}
                    value={vendorNames[v]}
                    onChange={(e) =>
                      setNames({ ...vendorNames, [v]: e.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="stats">
            <div className="stat">
              <strong>{pct(scores.v1)}</strong>
              <span>{vendorNames.v1}</span>
            </div>
            <div className="stat">
              <strong>{pct(scores.v2)}</strong>
              <span>{vendorNames.v2}</span>
            </div>
            <div className="stat">
              <strong>{pct(scores.v3)}</strong>
              <span>{vendorNames.v3}</span>
            </div>
            <div className="stat">
              <strong>{gaps.length}</strong>
              <span>Gaps comuns</span>
            </div>
          </div>

          <div className="toolbar-row">
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                if (confirm("Zerar todas as marcações?")) {
                  const wipe = Object.fromEntries(
                    ITEMS.map((i) => [i.id, defaultState()])
                  );
                  setItemState(wipe);
                  persist({ itemState: wipe });
                  flash("Checklist zerado.");
                }
              }}
            >
              Resetar
            </button>
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
              <div>
                <label>Decisão</label>
                <select
                  value={filterDecisao}
                  onChange={(e) => setFilterDecisao(e.target.value)}
                >
                  <option value="all">Todas</option>
                  {DECISAO.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Gap</label>
                <select
                  value={filterGap}
                  onChange={(e) => setFilterGap(e.target.value)}
                >
                  <option value="all">Sem filtro</option>
                  <option value="comum">Só gaps comuns</option>
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

            if (p === "sintese") {
              return (
                <section key={String(p)} className="section">
                  <h2>{title}</h2>
                  <div className="table-wrap">
                    <table className="table-eval">
                      <thead>
                        <tr>
                          <th className="col-narrow">ID</th>
                          <th>Pergunta</th>
                          <th>Resposta</th>
                          <th className="col-narrow">Roadmap</th>
                          <th className="col-narrow">Decisão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((i) => {
                          const st = itemState[i.id] ?? defaultState();
                          return (
                            <tr key={i.id}>
                              <td className="id">{i.id}</td>
                              <td>{i.texto}</td>
                              <td>
                                <input
                                  value={st.resposta ?? ""}
                                  onChange={(e) =>
                                    patchItem(i.id, {
                                      resposta: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td>
                                <select
                                  value={st.roadmap}
                                  onChange={(e) =>
                                    patchItem(i.id, {
                                      roadmap: e.target
                                        .value as (typeof ROADMAP)[number],
                                    })
                                  }
                                >
                                  {ROADMAP.map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <select
                                  value={st.decisao}
                                  onChange={(e) =>
                                    patchItem(i.id, {
                                      decisao: e.target
                                        .value as (typeof DECISAO)[number],
                                    })
                                  }
                                >
                                  {DECISAO.map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            }

            return (
              <section key={String(p)} className="section">
                <h2>{title}</h2>
                <div className="table-wrap">
                  <table className="table-compare">
                    <thead>
                      <tr>
                        <th className="col-narrow">ID</th>
                        <th>Item</th>
                        <th className="col-narrow">Tipo</th>
                        <th>{vendorNames.v1}</th>
                        <th>{vendorNames.v2}</th>
                        <th>{vendorNames.v3}</th>
                        <th className="col-narrow">Roadmap</th>
                        <th className="col-narrow">Decisão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((i) => {
                        const st = itemState[i.id] ?? defaultState();
                        return (
                          <tr key={i.id}>
                            <td className="id">{i.id}</td>
                            <td>{i.texto}</td>
                            <td>
                              <span className="badge">{i.tipo}</span>
                            </td>
                            {VENDORS.map((v) => (
                              <td key={v}>
                                <select
                                  value={st.coberturas[v]}
                                  onChange={(e) =>
                                    patchItem(i.id, {
                                      coberturas: {
                                        ...st.coberturas,
                                        [v]: e.target
                                          .value as (typeof COVERAGE)[number],
                                      },
                                    })
                                  }
                                >
                                  {COVERAGE.map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            ))}
                            <td>
                              <select
                                value={st.roadmap}
                                onChange={(e) =>
                                  patchItem(i.id, {
                                    roadmap: e.target
                                      .value as (typeof ROADMAP)[number],
                                  })
                                }
                              >
                                {ROADMAP.map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <select
                                value={st.decisao}
                                onChange={(e) =>
                                  patchItem(i.id, {
                                    decisao: e.target
                                      .value as (typeof DECISAO)[number],
                                  })
                                }
                              >
                                {DECISAO.map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
            </>
          )}
        </>
      )}

      {tab === "empresas" && (
        <Suspense
          fallback={<div className="panel muted">Carregando empresas…</div>}
        >
          <CompaniesPanel
            dataset={liveDataset}
            highlightId={highlightCompanyId}
            selectedId={highlightCompanyId ?? activeCompanyId}
            onSelectCompany={(id) => setActiveCompanyId(id)}
            onEditCompany={editCompanyInChecklist}
            onPatchEval={patchCompanyEval}
            onRequestSync={openSync}
            dirty={dirty}
          />
        </Suspense>
      )}

      {tab === "nao" && (
        <NaoPanel
          dataset={liveDataset}
          userCount={userCompanies.length}
          dirty={dirty}
          syncState={syncState}
          onRequestSync={openSync}
        />
      )}

      <p className="foot">
        Pipeline Avaliar → Empresas → Nao · Cobertura = (Tem + 0.5×Parcial) /
        total ·{" "}
        <a href="https://github.com/getnao/nao" target="_blank" rel="noreferrer">
          getnao/nao
        </a>
        .
      </p>
    </div>
  );
}
