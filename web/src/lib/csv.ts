import {
  type ChecklistItem,
  type Coverage,
  type Decisao,
  type ItemState,
  type Roadmap,
  type VendorId,
  defaultState,
  isCoverage,
  isDecisao,
  isRoadmap,
} from "./types";

function esc(cell: string): string {
  if (/[",\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function exportChecklistCsv(
  items: ChecklistItem[],
  vendorNames: Record<VendorId, string>,
  state: Record<string, ItemState>
): string {
  const headers = [
    "ID",
    "Pilar",
    "Tipo",
    "Item",
    vendorNames.v1,
    vendorNames.v2,
    vendorNames.v3,
    "Roadmap",
    "Decisão",
    "Resposta",
    "Notas",
  ];
  const lines = [headers.map(esc).join(",")];
  for (const item of items) {
    const st = state[item.id] ?? defaultState();
    const pilar =
      item.pilar === "sintese" ? "sintese" : String(item.pilar);
    lines.push(
      [
        item.id,
        pilar,
        item.tipo,
        item.texto,
        item.pilar === "sintese" ? "" : st.coberturas.v1,
        item.pilar === "sintese" ? "" : st.coberturas.v2,
        item.pilar === "sintese" ? "" : st.coberturas.v3,
        st.roadmap,
        st.decisao,
        st.resposta ?? "",
        "",
      ]
        .map(esc)
        .join(",")
    );
  }
  // Metadata row for vendor names (comment-style first lines via #META)
  const meta = `#META,v1,${esc(vendorNames.v1)},v2,${esc(vendorNames.v2)},v3,${esc(vendorNames.v3)}`;
  return "\uFEFF" + meta + "\n" + lines.join("\n");
}

export type ImportResult = {
  vendorNames?: Partial<Record<VendorId, string>>;
  itemState: Record<string, ItemState>;
  updated: number;
  errors: string[];
};

export function importChecklistCsv(
  text: string,
  items: ChecklistItem[]
): ImportResult {
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const errors: string[] = [];
  let vendorNames: Partial<Record<VendorId, string>> | undefined;
  const itemState: Record<string, ItemState> = {};
  let updated = 0;

  const rawLines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const dataLines: string[] = [];
  for (const line of rawLines) {
    if (!line.trim()) continue;
    if (line.startsWith("#META")) {
      const parts = parseLine(line);
      // #META,v1,name,v2,name,v3,name
      vendorNames = {
        v1: parts[2] || undefined,
        v2: parts[4] || undefined,
        v3: parts[6] || undefined,
      };
      continue;
    }
    dataLines.push(line);
  }

  if (dataLines.length < 2) {
    return { itemState: {}, updated: 0, errors: ["CSV vazio ou sem dados."] };
  }

  const header = parseLine(dataLines[0]).map((h) => h.trim().toLowerCase());
  const idx = (names: string[]) =>
    header.findIndex((h) => names.includes(h));

  const iId = idx(["id"]);
  const iV1 = idx(["v1", "fornecedor a", "fornecedor a (v1)"]);
  const iV2 = idx(["v2", "fornecedor b", "fornecedor b (v2)"]);
  const iV3 = idx(["v3", "fornecedor c", "fornecedor c (v3)"]);
  // Also match custom vendor header names by position after Tipo/Item
  let cV1 = iV1;
  let cV2 = iV2;
  let cV3 = iV3;
  if (cV1 < 0 || cV2 < 0 || cV3 < 0) {
    // Heuristic: columns 4,5,6 after ID,Pilar,Tipo,Item
    if (header.length >= 7) {
      cV1 = 4;
      cV2 = 5;
      cV3 = 6;
      if (!vendorNames) {
        vendorNames = {
          v1: dataLines[0] ? parseLine(dataLines[0])[4] : "Fornecedor A",
          v2: parseLine(dataLines[0])[5],
          v3: parseLine(dataLines[0])[6],
        };
      }
    }
  }
  const iRoad = idx(["roadmap"]);
  const iDec = idx(["decisão", "decisao"]);
  const iResp = idx(["resposta", "resposta inventário", "resposta inventario"]);

  if (iId < 0) {
    return {
      itemState: {},
      updated: 0,
      errors: ["Coluna ID não encontrada no CSV."],
    };
  }

  for (let r = 1; r < dataLines.length; r++) {
    const cols = parseLine(dataLines[r]);
    const id = (cols[iId] || "").trim();
    if (!id || !byId[id]) {
      if (id) errors.push(`ID desconhecido ignorado: ${id}`);
      continue;
    }
    const cur = defaultState();
    const item = byId[id];
    if (item.pilar !== "sintese") {
      const a = (cols[cV1] || "—").trim();
      const b = (cols[cV2] || "—").trim();
      const c = (cols[cV3] || "—").trim();
      cur.coberturas = {
        v1: isCoverage(a) ? a : "—",
        v2: isCoverage(b) ? b : "—",
        v3: isCoverage(c) ? c : "—",
      };
      if (!isCoverage(a) && a) errors.push(`${id}: cobertura inválida v1 (${a})`);
      if (!isCoverage(b) && b) errors.push(`${id}: cobertura inválida v2 (${b})`);
      if (!isCoverage(c) && c) errors.push(`${id}: cobertura inválida v3 (${c})`);
    }
    if (iRoad >= 0) {
      const v = (cols[iRoad] || "—").trim();
      cur.roadmap = isRoadmap(v) ? v : "—";
    }
    if (iDec >= 0) {
      const v = (cols[iDec] || "—").trim();
      cur.decisao = isDecisao(v) ? (v as Decisao) : "—";
    }
    if (iResp >= 0) {
      cur.resposta = cols[iResp] || "";
    }
    itemState[id] = cur;
    updated++;
  }

  return { vendorNames, itemState, updated, errors: errors.slice(0, 20) };
}

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function mergeImportedState(
  current: Record<string, ItemState>,
  imported: Record<string, ItemState>,
  items: ChecklistItem[]
): Record<string, ItemState> {
  const next = { ...current };
  for (const item of items) {
    if (imported[item.id]) next[item.id] = imported[item.id];
    else if (!next[item.id]) next[item.id] = defaultState();
  }
  return next;
}

export type { Coverage, Roadmap };
