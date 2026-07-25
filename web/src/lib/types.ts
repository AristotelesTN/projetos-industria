export type Coverage = "—" | "Não tem" | "Parcial" | "Tem";
export type Roadmap = "—" | "Backlog" | "Em curso" | "Feito";
export type Decisao = "—" | "Comprar" | "Construir" | "Híbrido" | "Adiar";
export type VendorId = "v1" | "v2" | "v3";
export type TabId = "checklist" | "empresas" | "nao";

export type ChecklistItem = {
  id: string;
  pilar: number | "sintese";
  tipo: "Expectativa" | "Avançado" | "Inventario";
  texto: string;
};

export type ItemState = {
  coberturas: Record<VendorId, Coverage>;
  roadmap: Roadmap;
  decisao: Decisao;
  resposta?: string;
};

export const VENDORS: VendorId[] = ["v1", "v2", "v3"];
export const STORAGE_KEY = "plataforma-ia-industrial-checklist-v3";

export const PILLAR_NAMES: Record<string, string> = {
  "1": "Dados e camada de contexto",
  "2": "Desenvolvimento",
  "3": "Testes e avaliação",
  "4": "Implantação",
  "5": "Orquestração",
  "6": "Governança e controle",
  "7": "Aplicações e serviços",
  sintese: "Inventário organizacional",
};

export const COVERAGE: Coverage[] = ["—", "Não tem", "Parcial", "Tem"];
export const ROADMAP: Roadmap[] = ["—", "Backlog", "Em curso", "Feito"];
export const DECISAO: Decisao[] = [
  "—",
  "Comprar",
  "Construir",
  "Híbrido",
  "Adiar",
];

export function defaultState(): ItemState {
  return {
    coberturas: { v1: "—", v2: "—", v3: "—" },
    roadmap: "—",
    decisao: "—",
    resposta: "",
  };
}

export function score(c: Coverage): number {
  if (c === "Tem") return 1;
  if (c === "Parcial") return 0.5;
  return 0;
}

export function coveragePct(
  items: ChecklistItem[],
  state: Record<string, ItemState>,
  vendor: VendorId,
  pilar?: number
): number {
  const subset = items.filter(
    (i) => i.pilar !== "sintese" && (pilar === undefined || i.pilar === pilar)
  );
  if (!subset.length) return 0;
  const sum = subset.reduce(
    (acc, i) =>
      acc + score((state[i.id] ?? defaultState()).coberturas[vendor]),
    0
  );
  return sum / subset.length;
}

export function pct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

export function isGap(st: ItemState) {
  return VENDORS.every((v) => {
    const c = st.coberturas[v];
    return c === "—" || c === "Não tem";
  });
}

export function isCoverage(v: string): v is Coverage {
  return (COVERAGE as string[]).includes(v);
}
export function isRoadmap(v: string): v is Roadmap {
  return (ROADMAP as string[]).includes(v);
}
export function isDecisao(v: string): v is Decisao {
  return (DECISAO as string[]).includes(v);
}
