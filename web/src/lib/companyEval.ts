import type { ChecklistItem, Coverage, Decisao, Roadmap } from "./types";
import { score } from "./types";
import type { MockAvaliacao, MockDataset, MockEmpresa } from "./mock";

export const COMPANIES_STORAGE_KEY = "plataforma-ia-industrial-empresas-v1";

export type CompanyItemEval = {
  cobertura: Coverage;
  roadmap: Roadmap;
  decisao: Decisao;
  resposta?: string;
  comentario?: string;
};

export type UserCompany = {
  id: string;
  nome: string;
  setor: string;
  porte: string;
  regiao: string;
  uf: string;
  maturidade: string;
  funcionarios: number;
  faturamentoMiBrl: number;
  /** user = criada no app; mock-edit = clonada da base mock */
  source: "user" | "mock-edit";
  items: Record<string, CompanyItemEval>;
  updatedAt: string;
};

export function defaultItemEval(): CompanyItemEval {
  return {
    cobertura: "—",
    roadmap: "—",
    decisao: "—",
    resposta: "",
    comentario: "",
  };
}

export function loadUserCompanies(): UserCompany[] {
  try {
    const raw = localStorage.getItem(COMPANIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.companies) ? parsed.companies : [];
  } catch {
    return [];
  }
}

export function saveUserCompanies(companies: UserCompany[]) {
  localStorage.setItem(
    COMPANIES_STORAGE_KEY,
    JSON.stringify({ companies, savedAt: new Date().toISOString() })
  );
}

export function nextUserCompanyId(existing: UserCompany[]): string {
  const nums = existing
    .map((c) => /^u(\d+)$/.exec(c.id)?.[1])
    .filter(Boolean)
    .map((n) => Number(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `u${String(max + 1).padStart(2, "0")}`;
}

export function blankCompany(partial: Partial<UserCompany> & { nome: string }): UserCompany {
  return {
    id: partial.id ?? `u${Date.now()}`,
    nome: partial.nome,
    setor: partial.setor ?? "Indústria",
    porte: partial.porte ?? "Média",
    regiao: partial.regiao ?? "Sudeste",
    uf: partial.uf ?? "SP",
    maturidade: partial.maturidade ?? "emergente",
    funcionarios: partial.funcionarios ?? 1000,
    faturamentoMiBrl: partial.faturamentoMiBrl ?? 500,
    source: partial.source ?? "user",
    items: partial.items ?? {},
    updatedAt: new Date().toISOString(),
  };
}

export function companyCoverageStats(
  company: UserCompany,
  items: ChecklistItem[]
) {
  const platform = items.filter((i) => i.pilar !== "sintese");
  let sum = 0;
  let tem = 0;
  let parcial = 0;
  let nao = 0;
  let comprar = 0;
  let construir = 0;
  let hibrido = 0;
  for (const i of platform) {
    const ev = company.items[i.id] ?? defaultItemEval();
    sum += score(ev.cobertura);
    if (ev.cobertura === "Tem") tem++;
    else if (ev.cobertura === "Parcial") parcial++;
    else if (ev.cobertura === "Não tem") nao++;
    if (ev.decisao === "Comprar") comprar++;
    else if (ev.decisao === "Construir") construir++;
    else if (ev.decisao === "Híbrido") hibrido++;
  }
  return {
    coberturaMedia: platform.length ? sum / platform.length : 0,
    itensTem: tem,
    itensParcial: parcial,
    itensNaoTem: nao,
    decisaoComprar: comprar,
    decisaoConstruir: construir,
    decisaoHibrido: hibrido,
  };
}

export function toMockEmpresa(
  company: UserCompany,
  items: ChecklistItem[]
): MockEmpresa {
  const s = companyCoverageStats(company, items);
  return {
    id: company.id,
    nome: company.nome,
    setor: company.setor,
    porte: company.porte,
    regiao: company.regiao,
    uf: company.uf,
    funcionarios: company.funcionarios,
    faturamentoMiBrl: company.faturamentoMiBrl,
    maturidade: company.maturidade,
    ano: new Date().getFullYear(),
    ...s,
  };
}

export function toMockAvaliacoes(
  company: UserCompany,
  items: ChecklistItem[]
): MockAvaliacao[] {
  return items.map((i) => {
    const ev = company.items[i.id] ?? defaultItemEval();
    return {
      itemId: i.id,
      pilar: i.pilar,
      tipo: i.tipo,
      texto: i.texto,
      cobertura: ev.cobertura,
      score: score(ev.cobertura),
      roadmap: ev.roadmap,
      decisao: ev.decisao,
      resposta: ev.resposta ?? "",
      comentario: ev.comentario ?? "",
    };
  });
}

/** Mock seed + empresas do usuário (usuário sobrescreve mesmo id). */
export function mergeDataset(
  seed: MockDataset,
  userCompanies: UserCompany[],
  items: ChecklistItem[]
): MockDataset {
  const byId = new Map(seed.empresas.map((e) => [e.id, e]));
  const av = { ...seed.avaliacoes };
  for (const c of userCompanies) {
    byId.set(c.id, toMockEmpresa(c, items));
    av[c.id] = toMockAvaliacoes(c, items);
  }
  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    empresas: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)),
    avaliacoes: av,
  };
}

/** Adota empresa da base (mesmo id) para edição local — sobrescreve o seed no merge. */
export function adoptMockToUser(
  mock: MockEmpresa,
  avaliacoes: MockAvaliacao[]
): UserCompany {
  const items: Record<string, CompanyItemEval> = {};
  for (const a of avaliacoes) {
    items[a.itemId] = {
      cobertura: (a.cobertura as Coverage) || "—",
      roadmap: (a.roadmap as Roadmap) || "—",
      decisao: (a.decisao as Decisao) || "—",
      resposta: a.resposta || "",
      comentario: a.comentario || "",
    };
  }
  return blankCompany({
    id: mock.id,
    nome: mock.nome,
    setor: mock.setor,
    porte: mock.porte,
    regiao: mock.regiao,
    uf: mock.uf,
    maturidade: String(mock.maturidade),
    funcionarios: mock.funcionarios,
    faturamentoMiBrl: mock.faturamentoMiBrl,
    source: "mock-edit",
    items,
  });
}

export function cloneMockToUser(
  mock: MockEmpresa,
  avaliacoes: MockAvaliacao[],
  existing: UserCompany[]
): UserCompany {
  const base = adoptMockToUser(mock, avaliacoes);
  return {
    ...base,
    id: nextUserCompanyId(existing),
    nome: `${mock.nome} (cópia)`,
  };
}

export const SETORES_OPTS = [
  "Automotivo",
  "Alimentos e bebidas",
  "Mineração",
  "Óleo e gás",
  "Química",
  "Papel e celulose",
  "Farmacêutico",
  "Metalurgia",
  "Energia",
  "Logística",
  "Máquinas e equipamentos",
  "Agronegócio",
  "Indústria",
  "Integração / Control plane",
  "SDK / Multi-agent (TypeScript)",
  "Memória agentic / Edge",
  "CRM / Agent platform",
  "Industrial AI / OT-IT orchestration",
  "Industrial DataOps / Agents",
  "Industrial software / OT data",
  "Ontology / Decision platform",
  "Process industries / APC",
  "Discrete automation / MES",
  "Manufacturing ops / HMI-MES",
  "Outro",
];

export const REGIAO_OPTS = [
  "Sudeste",
  "Sul",
  "Nordeste",
  "Centro-Oeste",
  "Norte",
];

export const PORTE_OPTS = ["Média", "Grande", "Enterprise"];
export const MAT_OPTS = ["inicial", "emergente", "avançada", "líder"];
