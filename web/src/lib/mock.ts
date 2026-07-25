export type MaturidadeIa = "inicial" | "emergente" | "avançada" | "líder";

export type MockEmpresa = {
  id: string;
  nome: string;
  setor: string;
  porte: string;
  regiao: string;
  uf: string;
  funcionarios: number;
  faturamentoMiBrl: number;
  maturidade: MaturidadeIa | string;
  ano: number;
  coberturaMedia: number;
  itensTem: number;
  itensParcial: number;
  itensNaoTem: number;
  decisaoComprar: number;
  decisaoConstruir: number;
  decisaoHibrido: number;
};

export type MockAvaliacao = {
  itemId: string;
  pilar: number | "sintese" | string;
  tipo: string;
  texto: string;
  cobertura: string;
  score: number;
  roadmap: string;
  decisao: string;
  resposta: string;
  /** Justificativa da nota / marcações (heurística pública ou nota do avaliador). */
  comentario?: string;
};

export type MockDataset = {
  generatedAt: string;
  empresas: MockEmpresa[];
  avaliacoes: Record<string, MockAvaliacao[]>;
};

export function formatFat(mi: number) {
  if (mi >= 1000) return `R$ ${(mi / 1000).toFixed(1)} bi`;
  return `R$ ${mi.toFixed(0)} mi`;
}

export function coberturaBarColor(n: number) {
  if (n >= 0.7) return "var(--ok)";
  if (n >= 0.45) return "var(--teal)";
  if (n >= 0.3) return "var(--warn)";
  return "var(--danger)";
}
