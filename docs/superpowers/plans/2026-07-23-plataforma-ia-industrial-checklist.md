# Plataforma IA Industrial Checklist (multi-vendor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar checklist interativa (canvas) + Markdown versionável para avaliar 3 fornecedores lado a lado e acompanhar roadmap buy/build da Plataforma IA Industrial.

**Architecture:** Dados canônicos dos itens vivem na spec; o Markdown é a fonte oficial preenchível; o canvas embute a mesma lista inline (sem `fetch`) com estado local via `useCanvasState` para coberturas, roadmap, decisão e nomes dos vendors. Métricas: cobertura ponderada `(Tem + 0.5×Parcial) / total` por vendor e por pilar.

**Tech Stack:** Markdown no repo; Cursor Canvas (React via `cursor/canvas`: Stack, Grid, Stat, Table, Select, TextInput, Pill, Card, BarChart, useHostTheme, useCanvasState).

**Spec:** `docs/superpowers/specs/2026-07-23-plataforma-ia-industrial-checklist-design.md`

## Global Constraints

- Exatamente 3 vendors: ids `v1`, `v2`, `v3`; nomes editáveis; defaults `Fornecedor A/B/C`.
- Cobertura por vendor: `—` | `Não tem` | `Parcial` | `Tem`.
- Roadmap (único, org): `—` | `Backlog` | `Em curso` | `Feito`.
- Decisão (única, org): `—` | `Comprar` | `Construir` | `Híbrido` | `Adiar`.
- Inventário `S.1`–`S.9` sem colunas de vendor.
- Canvas path obrigatório: `/Users/aristotelestn/.cursor/projects/Users-aristotelestn-Projects-projetos-industria/canvases/plataforma-ia-industrial-checklist.canvas.tsx`
- Importar **somente** de `cursor/canvas`; sem hex hardcoded; sem gradients/emojis/box-shadow.
- Não commitar a menos que o usuário peça.

## File Structure

| File | Responsibility |
|------|----------------|
| `docs/plataforma-ia-industrial/checklist.md` | Fonte oficial: metadados, legenda, resumo, tabelas por pilar, inventário |
| `.../canvases/plataforma-ia-industrial-checklist.canvas.tsx` | UI interativa: ranking, filtros, edição local, tabelas |

Shared content: todos os itens `1.1`…`7.A5` e `S.1`…`S.9` conforme a spec (copiar textos verbatim).

---

### Task 1: Markdown checklist multi-vendor

**Files:**
- Create: `docs/plataforma-ia-industrial/checklist.md`

**Interfaces:**
- Consumes: itens e IDs da spec §4
- Produces: documento Markdown com colunas `v1`/`v2`/`v3` + Roadmap + Decisão + Notas

- [ ] **Step 1: Criar o arquivo com cabeçalho, legenda e metadados**

Incluir no topo:

```markdown
# Checklist — Plataforma IA Industrial

| Campo | Valor |
|-------|-------|
| Data | 2026-07-23 |
| Responsável | — |
| Fornecedor A (`v1`) | Fornecedor A |
| Fornecedor B (`v2`) | Fornecedor B |
| Fornecedor C (`v3`) | Fornecedor C |

## Legenda

**Cobertura (por fornecedor):** `—` não avaliado · `Não tem` · `Parcial` · `Tem`

**Roadmap (organização):** `—` · `Backlog` · `Em curso` · `Feito`

**Decisão (organização):** `—` · `Comprar` · `Construir` · `Híbrido` · `Adiar`

**Cobertura ponderada:** `(#Tem + 0.5 × #Parcial) / total` nos itens dos pilares 1–7.
```

- [ ] **Step 2: Adicionar tabela-resumo comparativa (placeholders)**

```markdown
## Resumo comparativo

| Métrica | v1 | v2 | v3 |
|---------|----|----|-----|
| Cobertura ponderada (total) | — | — | — |
| Pilar 1 Dados | — | — | — |
| Pilar 2 Desenvolvimento | — | — | — |
| Pilar 3 Testes | — | — | — |
| Pilar 4 Implantação | — | — | — |
| Pilar 5 Orquestração | — | — | — |
| Pilar 6 Governança | — | — | — |
| Pilar 7 Aplicações | — | — | — |
```

(Valores `—` até preenchimento manual; o canvas calcula ao vivo.)

- [ ] **Step 3: Gerar uma tabela por pilar (1–7)**

Para cada pilar, seção com objetivo (1 frase da spec) e tabela:

```markdown
| ID | Item | Tipo | v1 | v2 | v3 | Roadmap | Decisão | Notas |
|----|------|------|----|----|-----|---------|---------|-------|
| 1.1 | Conectores pré-construídos… | Expectativa | — | — | — | — | — | |
```

Incluir **todos** os itens Expectativa e Avançado da spec (sem omitir nenhum ID).

- [ ] **Step 4: Tabela de inventário S.1–S.9**

```markdown
| ID | Pergunta | Resposta | Roadmap | Decisão | Notas |
|----|----------|----------|---------|---------|-------|
| S.1 | Quais agentes existem? | | — | — | |
```

- [ ] **Step 5: Verificar cobertura de IDs**

Run:

```bash
rg -o '\| [0-9]+\.[0-9A]+ \|' docs/plataforma-ia-industrial/checklist.md | wc -l
rg -o '\| S\.[0-9]+ \|' docs/plataforma-ia-industrial/checklist.md | wc -l
```

Expected: contagem de IDs de pilares ≥ 70 (expectativas+avançados da spec); inventário = 9.

Manual: cruzar com a spec §4 se algum ID faltar — adicionar antes de seguir.

---

### Task 2: Canvas — dados e métricas

**Files:**
- Create: `/Users/aristotelestn/.cursor/projects/Users-aristotelestn-Projects-projetos-industria/canvases/plataforma-ia-industrial-checklist.canvas.tsx`

**Interfaces:**
- Consumes: mesma lista de itens da Task 1 / spec
- Produces: tipos e helpers usados pela UI (Task 3)

- [ ] **Step 1: Scaffold do arquivo com imports e tipos**

```tsx
import {
  BarChart,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Select,
  Stack,
  Stat,
  Table,
  Text,
  TextInput,
  useCanvasState,
  useHostTheme,
} from "cursor/canvas";

type Coverage = "—" | "Não tem" | "Parcial" | "Tem";
type Roadmap = "—" | "Backlog" | "Em curso" | "Feito";
type Decisao = "—" | "Comprar" | "Construir" | "Híbrido" | "Adiar";
type VendorId = "v1" | "v2" | "v3";
type ItemTipo = "Expectativa" | "Avançado" | "Inventario";

type ChecklistItem = {
  id: string;
  pilar: 1 | 2 | 3 | 4 | 5 | 6 | 7 | "sintese";
  tipo: ItemTipo;
  texto: string;
};

type ItemState = {
  coberturas: Record<VendorId, Coverage>;
  roadmap: Roadmap;
  decisao: Decisao;
  resposta?: string;
};
```

- [ ] **Step 2: Embutir array `ITEMS` completo**

Copiar todos os itens da spec para `const ITEMS: ChecklistItem[] = [...]` (pilares 1–7 + síntese). Não usar `fetch`.

- [ ] **Step 3: Implementar helpers de métrica**

```tsx
function coverageScore(c: Coverage): number {
  if (c === "Tem") return 1;
  if (c === "Parcial") return 0.5;
  return 0;
}

function vendorCoverage(
  items: ChecklistItem[],
  state: Record<string, ItemState>,
  vendor: VendorId,
  pilar?: number
): number {
  const subset = items.filter(
    (i) => i.pilar !== "sintese" && (pilar === undefined || i.pilar === pilar)
  );
  if (subset.length === 0) return 0;
  const sum = subset.reduce(
    (acc, i) => acc + coverageScore(state[i.id]?.coberturas[vendor] ?? "—"),
    0
  );
  return sum / subset.length;
}

function defaultItemState(): ItemState {
  return {
    coberturas: { v1: "—", v2: "—", v3: "—" },
    roadmap: "—",
    decisao: "—",
  };
}
```

- [ ] **Step 4: Estado inicial com `useCanvasState`**

```tsx
const [vendorNames, setVendorNames] = useCanvasState("vendorNames", {
  v1: "Fornecedor A",
  v2: "Fornecedor B",
  v3: "Fornecedor C",
});
const [itemState, setItemState] = useCanvasState<Record<string, ItemState>>(
  "itemState",
  Object.fromEntries(ITEMS.map((i) => [i.id, defaultItemState()]))
);
const [filterPilar, setFilterPilar] = useCanvasState("filterPilar", "all");
const [filterTipo, setFilterTipo] = useCanvasState("filterTipo", "all");
const [filterDecisao, setFilterDecisao] = useCanvasState("filterDecisao", "all");
const [filterGap, setFilterGap] = useCanvasState("filterGap", "all");
```

`filterGap` valores: `all` | `comum` (todos Não tem ou —) | `unico-v1` | `unico-v2` | `unico-v3` (apenas esse vendor tem `Tem`).

---

### Task 3: Canvas — UI (resumo, filtros, tabelas)

**Files:**
- Modify: mesmo `plataforma-ia-industrial-checklist.canvas.tsx`

**Interfaces:**
- Consumes: `ITEMS`, `vendorCoverage`, estado da Task 2
- Produces: default export do componente canvas

- [ ] **Step 1: Header + edição dos 3 nomes + Stats de ranking**

Layout:
- `H1`: Checklist — Plataforma IA Industrial
- 3 `TextInput` para nomes v1/v2/v3
- `Grid` com 3 `Stat`: cobertura % de cada vendor (total)
- `Stat` de % roadmap Feito
- Contagem de decisões (texto ou Pills)

- [ ] **Step 2: BarChart cobertura por pilar × vendor**

Montar `ChartSeries` com 3 séries (nomes dos vendors) e pontos para pilares 1–7 (valor = cobertura × 100). Título: “Cobertura ponderada por pilar (%)”.

- [ ] **Step 3: Filtros (Select)**

Selects: Pilar (all|1…7|sintese), Tipo, Decisão, Gap. Filtrar `ITEMS` antes de renderizar tabelas.

- [ ] **Step 4: Tabelas por pilar**

Para cada pilar 1–7 (respeitando filtro):
- `H2` com nome do pilar
- `Table` com colunas: ID, Item, Tipo, {nome v1}, {nome v2}, {nome v3}, Roadmap, Decisão
- Células de cobertura/roadmap/decisão: `Select` que atualiza `itemState` via `setItemState`

Para síntese: colunas ID, Pergunta, Resposta (`TextInput`), Roadmap, Decisão — sem vendors.

- [ ] **Step 5: Callout de gaps comuns**

Se `filterGap === "comum"` ou sempre no rodapé: listar até 10 IDs onde os 3 vendors ∈ {`—`,`Não tem`}, sugerindo decisão Construir.

- [ ] **Step 6: Self-check visual / tipos**

Abrir o canvas no Cursor. Confirmar:
- ranking muda ao alterar um Select de cobertura
- nomes dos vendors refletem nas colunas
- sem erros de TypeScript no retorno do save (`Canvas TypeScript check: no errors`)

---

### Task 4: Alinhamento Markdown ↔ Canvas + aceite

**Files:**
- Modify: `docs/plataforma-ia-industrial/checklist.md` (só se faltar ID)
- Modify: canvas (só se faltar ID)

- [ ] **Step 1: Diff de IDs**

```bash
python3 << 'PY'
import re
from pathlib import Path
spec = Path("docs/superpowers/specs/2026-07-23-plataforma-ia-industrial-checklist-design.md").read_text()
md = Path("docs/plataforma-ia-industrial/checklist.md").read_text()
canvas = Path("/Users/aristotelestn/.cursor/projects/Users-aristotelestn-Projects-projetos-industria/canvases/plataforma-ia-industrial-checklist.canvas.tsx").read_text()
ids_spec = set(re.findall(r"\| ([0-9]+\.[0-9A]+|S\.[0-9]+) \|", spec))
ids_md = set(re.findall(r"\| ([0-9]+\.[0-9A]+|S\.[0-9]+) \|", md))
ids_c = set(re.findall(r'id:\s*"([0-9]+\.[0-9A]+|S\.[0-9]+)"', canvas))
print("spec", len(ids_spec), "md missing", sorted(ids_spec-ids_md), "canvas missing", sorted(ids_spec-ids_c))
PY
```

Expected: `md missing []` e `canvas missing []`.

- [ ] **Step 2: Critérios de aceite da spec §8**

Verificar mentalmente / na UI:
1. Todos os itens presentes
2. Markdown com 3 colunas + resumo
3. Canvas com nomes, ranking, pilar×vendor, edição
4. S.\* sem vendors
5. Legenda e metadados no Markdown

- [ ] **Step 3: Commit somente se o usuário pedir**

Não executar `git commit` automaticamente.

---

## Spec coverage (self-review)

| Spec | Task |
|------|------|
| 7 pilares + itens | Task 1 + 2 |
| Multi-vendor 3 slots | Task 1 + 2 + 3 |
| Roadmap + decisão org | Task 1 + 3 |
| Inventário S.\* | Task 1 + 3 |
| Métricas cobertura | Task 2 + 3 |
| Gap comum / ranking | Task 3 |
| Canvas path + markdown path | Tasks 1–3 |
| Sem sync auto / sem 4+ vendors | respeitado (constraints) |

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-23-plataforma-ia-industrial-checklist.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — subagente fresco por task, review entre tasks  
2. **Inline Execution** — executar nesta sessão com checkpoints

**Which approach?**
