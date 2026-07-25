import type { ChecklistItem } from "./types";
import type { MockDataset } from "./mock";

function esc(cell: string): string {
  if (/[",\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

export type NaoSyncPayload = {
  exportedAt: string;
  empresasCsv: string;
  avaliacoesCsv: string;
  empresaResumoCsv: string;
  itensCsv: string;
  meta: { nEmpresas: number; nAvaliacoes: number };
};

export function buildNaoSyncPayload(
  dataset: MockDataset,
  items: ChecklistItem[]
): NaoSyncPayload {
  const empresasHeaders = [
    "empresa_id",
    "nome",
    "setor",
    "porte",
    "regiao",
    "uf",
    "funcionarios",
    "faturamento_mi_brl",
    "maturidade_ia",
    "ano_avaliacao",
  ];
  const empresasLines = [empresasHeaders.join(",")];
  for (const e of dataset.empresas) {
    empresasLines.push(
      [
        e.id,
        esc(e.nome),
        esc(e.setor),
        esc(e.porte),
        esc(e.regiao),
        esc(e.uf),
        String(e.funcionarios),
        String(e.faturamentoMiBrl),
        esc(String(e.maturidade)),
        String(e.ano),
      ].join(",")
    );
  }

  const avHeaders = [
    "item_id",
    "pilar",
    "tipo",
    "texto",
    "empresa_id",
    "empresa_nome",
    "setor",
    "porte",
    "regiao",
    "maturidade_ia",
    "cobertura",
    "cobertura_score",
    "roadmap",
    "decisao",
    "resposta",
    "comentario",
  ];
  const avLines = [avHeaders.join(",")];
  let nAv = 0;
  for (const e of dataset.empresas) {
    const rows = dataset.avaliacoes[e.id] ?? [];
    for (const a of rows) {
      nAv++;
      avLines.push(
        [
          esc(a.itemId),
          esc(String(a.pilar)),
          esc(a.tipo),
          esc(a.texto),
          e.id,
          esc(e.nome),
          esc(e.setor),
          esc(e.porte),
          esc(e.regiao),
          esc(String(e.maturidade)),
          esc(a.cobertura),
          String(a.score),
          esc(a.roadmap),
          esc(a.decisao),
          esc(a.resposta || ""),
          esc(a.comentario || ""),
        ].join(",")
      );
    }
  }

  const resumoHeaders = [
    "empresa_id",
    "nome",
    "setor",
    "porte",
    "regiao",
    "maturidade_ia",
    "cobertura_media",
    "itens_tem",
    "itens_parcial",
    "itens_nao_tem",
    "gaps",
    "decisao_comprar",
    "decisao_construir",
    "decisao_hibrido",
  ];
  const resumoLines = [resumoHeaders.join(",")];
  for (const e of dataset.empresas) {
    resumoLines.push(
      [
        e.id,
        esc(e.nome),
        esc(e.setor),
        esc(e.porte),
        esc(e.regiao),
        esc(String(e.maturidade)),
        String(e.coberturaMedia),
        String(e.itensTem),
        String(e.itensParcial),
        String(e.itensNaoTem),
        String(e.itensNaoTem),
        String(e.decisaoComprar),
        String(e.decisaoConstruir),
        String(e.decisaoHibrido),
      ].join(",")
    );
  }

  const itensLines = ["item_id,pilar,tipo,texto"];
  for (const i of items) {
    itensLines.push(
      [i.id, esc(String(i.pilar)), esc(i.tipo), esc(i.texto)].join(",")
    );
  }

  return {
    exportedAt: new Date().toISOString(),
    empresasCsv: "\uFEFF" + empresasLines.join("\n"),
    avaliacoesCsv: "\uFEFF" + avLines.join("\n"),
    empresaResumoCsv: "\uFEFF" + resumoLines.join("\n"),
    itensCsv: "\uFEFF" + itensLines.join("\n"),
    meta: { nEmpresas: dataset.empresas.length, nAvaliacoes: nAv },
  };
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Tenta API local do Vite; senão faz download do pack. */
export async function syncToNao(
  dataset: MockDataset,
  items: ChecklistItem[]
): Promise<{ mode: "api" | "download"; message: string }> {
  const payload = buildNaoSyncPayload(dataset, items);
  const pack = {
    exportedAt: payload.exportedAt,
    meta: payload.meta,
    files: {
      "empresas.csv": payload.empresasCsv,
      "avaliacoes.csv": payload.avaliacoesCsv,
      "empresa_resumo.csv": payload.empresaResumoCsv,
      "itens.csv": payload.itensCsv,
    },
  };

  try {
    const res = await fetch("/api/nao-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pack),
    });
    if (res.ok) {
      const body = (await res.json()) as { ok?: boolean; message?: string };
      return {
        mode: "api",
        message:
          body.message ||
          `Nao sincronizado: ${payload.meta.nEmpresas} empresas.`,
      };
    }
  } catch {
    /* production / sem middleware */
  }

  const stamp = new Date().toISOString().slice(0, 10);
  downloadJson(`nao-sync-${stamp}.json`, pack);
  downloadText(`avaliacoes-${stamp}.csv`, payload.avaliacoesCsv);
  downloadText(`empresas-${stamp}.csv`, payload.empresasCsv);
  return {
    mode: "download",
    message:
      "Pack baixado. No repo: python nao/scripts/apply_sync_payload.py ~/Downloads/nao-sync-*.json",
  };
}

export function coverageScoreLabel(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

