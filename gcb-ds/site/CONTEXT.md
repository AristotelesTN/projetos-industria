# Design System GCB — Contexto para IA
**Grupo Cornélio Brennand · Tecnova**
Versão: 1.0 · Junho 2025

---

## O que é este documento

Este arquivo é o ponto de entrada para qualquer IA (Claude, Cursor, etc.) que vá gerar protótipos ou especificações baseados no DS GCB. Leia-o inteiro antes de produzir qualquer código ou artefato de design.

---

## Estrutura do repositório

**Convenção de nomes por marca:** todos os HTMLs ficam na raiz. Vivix usa prefixo `v-`, Atiaia usa `a-`, Corporativo não tem prefixo. Exemplo: `v-fundamentos.html` · `a-fundamentos.html` · `fundamentos.html`.

```
DS GCB (raiz)
├── assets/                    → logos, ícones, imagens
├── index.html                 → hub de navegação (Fio Start, Projeto Fio, DS)
├── ds.html                    → índice do DS (cards das marcas)
├── v-fundamentos.html         → tokens Vivix
├── v-componentes-web.html     → componentes Web Vivix
├── v-componentes-powerbi.html   → diretrizes Power BI Vivix
├── v-mendix.html              → diretrizes + mapeamento GCB→Mendix (Vivix)
├── v-mendix-shell.html        → ⭐ shell Mendix Vivix (USE ESTE)
├── v-sap-btp.html             → diretrizes + mapeamento GCB→SAP Fiori (Vivix)
├── v-sap-shell.html           → ⭐ shell SAP BTP Vivix (USE ESTE)
├── a-*.html                   → mesmos arquivos com prefixo a- (Atiaia)
├── *.html (sem prefixo)       → mesmos arquivos sem prefixo (Corporativo)
└── ironhouse/                 → fora do escopo da meta 2025 (existe mas não é prioritário)
```

---

## Marcas e suas diferenças

| Marca | Cor primária | Cor escura (header/dark) | Display font |
|---|---|---|---|
| Vivix | `#00b2a9` (VIVIX 02 · verde água) | `#005751` (VIVIX 01 · verde escuro) | Prometo Bold → Inter Semibold no digital |
| Atiaia | ver `a-fundamentos.html` ⚠️ | `#071d49` (Atiaia 01 · azul escuro) | Inter Semibold |
| Corporativo | `#ec7d07` (GCB 01 · laranja) | `#004952` (GCB 03 · verde escuro) | Inter Semibold |

**Paleta oficial de marca (fonte da verdade):**

| Marca | 01 | 02 | 03 | 04 | 05 |
|---|---|---|---|---|---|
| GCB / Corporativo | `#EC7D07` | `#E25015` | `#004952` | — | — |
| VIVIX | `#005751` | `#00B2A9` | `#E1E000` | — | — |
| Atiaia | `#071D49` | `#009CDE` | `#43A447` | `#8EC152` | `#44D62C` |

⚠️ **Pendência aberta — `--color-primary` da Atiaia.** Hoje `a-fundamentos.html` e
`a-componentes-web.html` declaram `#071d49`, enquanto `a-mendix-shell.html`,
`a-sap-shell.html` e o Fio Start usam `#009cde`. Os dois hex são oficiais; o que falta
é decidir qual assume o papel de primária. Nas outras marcas a posição 02 da paleta é a
primária e a 01 é a escura (VIVIX 02 `#00b2a9` = primária, VIVIX 01 `#005751` = escura),
o que sugere `#009cde` para a Atiaia. Definir antes de gerar novos protótipos.

**O que é sempre igual entre marcas:** tipografia Inter, sistema de espaçamento Carbon, cores semânticas, componentes, breakpoints, comportamentos.

---

## Contextos de uso — prioridade de aplicação

### 1. Mendix (PRINCIPAL)
Aplicações low-code construídas na plataforma Mendix usando Atlas UI.

**Regra fundamental:** configuration over customization. Não reinvente componentes. Customize apenas via theme settings.

**Para prototipar:** use o shell da marca correspondente como base (`v-mendix-shell.html`, `a-mendix-shell.html` ou `mendix-shell.html`). O arquivo já tem shell (header + sidebar colapsável), todos os componentes e classes CSS prontos. Substitua apenas o conteúdo de `.content`.

**Ícones no Mendix real:** Font Awesome (não Phosphor). Nos protótipos HTML use Phosphor — a tabela de equivalência está em `v-mendix.html` / `a-mendix.html` / `mendix.html` (conforme a marca) > seção Mapeamento > Ícones.

**Nunca faça em Mendix:**
- CSS com `!important`
- `position: absolute` para layout
- Fontes custom além de Inter
- Custom widgets sem aprovação do time

### 2. SAP BTP
Aplicações SAP usando SAPUI5 e Fiori Elements.

**Regra fundamental:** Fiori First. Use floorplans padrão (Object Page, List Report, Worklist). Customize apenas via SAP Theme Designer.

**Para prototipar:** use o shell da marca correspondente como base (`v-sap-shell.html`, `a-sap-shell.html` ou `sap-shell.html`). Tem ShellBar, Side Navigation, Object Page pattern e List Report pattern prontos.

**Padrões de layout Fiori:**
- **Object Page:** para visualização/edição de um registro (pedido, fornecedor, contrato)
- **List Report:** para listagem com filtros e tabela
- **Master-Detail:** lista à esquerda + detalhe à direita

**Status indicators SAP (semáforo):**
- Positive (verde) → `status--positive`
- Negative (vermelho) → `status--negative`
- Critical (amarelo) → `status--critical`
- Neutral (cinza) → `status--neutral`

### 3. Web
Aplicações web customizadas em HTML/CSS.

**Para prototipar:** use tokens do `*-fundamentos.html` da marca + componentes do `*-componentes-web.html` correspondente (ex.: `v-fundamentos.html` + `v-componentes-web.html`). O arquivo já tem grid system (12 colunas) e classes tipográficas completas.

### 4. Power BI
Dashboards e relatórios analíticos.

**Para prototipar:** use as diretrizes do `*-componentes-powerbi.html` da marca (ex.: `v-componentes-powerbi.html`). Power BI não é prototipado em HTML — o arquivo é referência editorial para quem vai construir os dashboards.

---

## Tokens essenciais — Vivix (referência)

```css
/* Cores de marca */
--color-primary:    #00b2a9;   /* teal — botões, active states, links de marca */
--color-dark:       #005751;   /* verde escuro — headers, sidebar, elementos de contraste */
--color-accent:     #e1e000;   /* amarelo — usar com moderação, nunca em texto */

/* Interação (NÃO varia por marca) */
--color-interactive: #0f62fe;  /* azul IBM — links, focus rings, checkboxes, toggles */

/* Semânticas (NÃO variam por marca) */
--color-success:  #24a148;
--color-warning:  #f1c21b;
--color-error:    #bb0000;
--color-info:     #007acc;

/* Texto */
--text-primary:   #161616;
--text-secondary: #525252;
--text-disabled:  #8d8d8d;

/* Bordas */
--border-subtle: #e0e0e0;
--border-strong: #8d8d8d;

/* Espaçamento (Carbon) */
--spacing-03: 8px;   --spacing-04: 12px;  --spacing-05: 16px;
--spacing-06: 24px;  --spacing-07: 32px;  --spacing-08: 40px;
```

---

## Aliases de tokens — Fundamentos ↔ Shells

Os shells Mendix e SAP usam nomes curtos por conveniência. Os fundamentos e componentes web declaram aliases que apontam para os tokens canônicos. Ambas as formas são válidas — use a que for natural para o contexto.

| Token canônico (fundamentos) | Alias curto (shells) |
|---|---|
| `--spacing-01` a `--spacing-10` | `--s-01` a `--s-10` |
| `--font-family` | `--font` |
| `--font-weight-light` | `--fw-light` |
| `--font-weight-regular` | `--fw-regular` |
| `--font-weight-medium` | `--fw-medium` |
| `--font-weight-semibold` | `--fw-semibold` |
| `--transition-fast` | `--t-fast` |
| `--transition-base` | `--t-base` |
| `--transition-slow` | `--t-slow` |
| `--easing-standard` | `--ease` |
| `--color-secondary-1` / `--color-neutral-dark` | `--color-dark` |
| `--color-secondary-2` | `--color-accent` |

**Regra:** nos shells, use os nomes curtos (já é o padrão). Nos protótipos Web ou em CSS novo, prefira os nomes canônicos. Nunca crie um terceiro nome para o mesmo token.

---

## Classes CSS disponíveis (Web e shells)

### Tipografia
`.text-display-01` `.text-display-02` `.text-h1` ... `.text-h6`
`.text-body-xl` `.text-body-lg` `.text-body-md` `.text-body-sm`
`.text-label-lg` `.text-label-md` `.text-label-sm` `.text-caption`

### Cores de texto
`.text-primary-color` `.text-secondary-color` `.text-disabled-color`
`.text-brand` `.text-success` `.text-error` `.text-warning` `.text-info`

### Grid (Web)
`.grid` (12 colunas) + `.col-1` ... `.col-12`
`.grid-2` `.grid-3` `.grid-4` (atalhos)
`.form-grid` (2 colunas para formulários, `.form-full` para campo de largura total)

### Componentes Web
`.btn` + `.btn-primary` `.btn-secondary` `.btn-ghost` `.btn-danger`
+ modificadores: `.btn--sm` `.btn--lg` `.btn--icon`

`.input-group` `.input-label` `.input-field` (estados: `.error` `.success` `.disabled`)
`.select-field` `.search-input`

`.card` `.card__header` `.card__title`
`.kpi-card` `.kpi-card__label` `.kpi-card__value` `.kpi-card__trend`
`.tag` + `.tag--success` `.tag--error` `.tag--warning` `.tag--info` `.tag--neutral` `.tag--primary`
`.data-table` dentro de `.table-container`
`.modal-overlay` `.modal` `.modal__header` `.modal__body` `.modal__footer`
`.alert` + `.alert--info` `.alert--warning` `.alert--error` `.alert--success`
`.empty-state` `.pagination` `.toast`

`.spinner` + `.spinner--sm` `.spinner--lg`
`.skeleton` + `.skeleton--text` `.skeleton--heading` `.skeleton--avatar` `.skeleton--card` `.skeleton--row`

---

## Regras de composição — o que nunca fazer

1. **Não inventar cores fora da paleta.** Qualquer cor deve estar nos tokens ou ser uma variação semântica. Dúvida? Use `--text-secondary` ou `--border-subtle`.

2. **Não hardcodar valores de espaçamento.** Use sempre os tokens `--spacing-XX` (nome canônico) ou `--s-XX` (alias curto nos shells). Veja a tabela completa na seção "Aliases de tokens".

3. **Não criar componentes novos quando um existente cobre o caso.** Verifique primeiro se o DS tem algo parecido antes de inventar.

4. **Não usar `!important`.** Se precisar forçar um estilo, reveja a arquitetura.

5. **Não misturar contexts.** Um protótipo Mendix usa o `*-mendix-shell.html` da marca. Um protótipo SAP usa o `*-sap-shell.html` da marca. Não combine shells nem marcas.

6. **Ícones: use Phosphor nos protótipos HTML.** No Mendix real, o dev vai converter para Font Awesome usando a tabela em `*-mendix.html` da marca. No SAP real, o dev usa SAP Icons.

7. **Sempre cobrir os estados obrigatórios:** vazio (empty state), carregando (skeleton/spinner), erro, sucesso, desabilitado. Nunca apenas o fluxo feliz.

8. **Tags de status** seguem o semáforo semântico: sucesso = verde, erro = vermelho, aviso = amarelo, info = azul, neutro = cinza. Nunca invertido.

9. **Não confundir `--color-primary` com `--color-interactive`.** `--color-primary` é a cor de marca (varia por marca: teal Vivix, azul Atiaia, laranja Corporativo) — use em botões primários, headers, brand elements. `--color-interactive` é azul IBM `#0f62fe` (fixo em todas as marcas) — use em links de texto, focus rings, checkboxes, toggles, e qualquer elemento de interação genérico.

---

## Como gerar um protótipo — passo a passo

### Mendix
1. Copie o shell da marca inteiro (ex.: `v-mendix-shell.html`)
2. Altere `[Nome da Aplicação]` no `<title>` e no `.header__app-name`
3. Substitua os itens de navegação da sidebar pelos módulos reais
4. Substitua o conteúdo demo dentro de `<main class="content">` pela tela solicitada
5. Mantenha `.page-header` (breadcrumb + título + descrição) e `.page-toolbar`
6. Use os componentes já definidos no CSS — não adicione estilos novos sem necessidade
7. Se precisar de um componente não disponível, sinalize com um comentário `<!-- DS GAP: [nome do componente] -->`

### SAP BTP
1. Copie o shell da marca inteiro (ex.: `v-sap-shell.html`)
2. Altere nome da aplicação no ShellBar
3. Para **Object Page** (detalhe de um registro): mantenha `.object-header` completo com breadcrumb, key facts e anchor navigation
4. Para **List Report** (listagem): substitua `.object-header` por `.list-report-header` + `.table-wrapper` com filtros e tabela
5. Use os status indicators do semáforo SAP (`.status--positive`, etc.)

### Web
1. Crie um HTML que importe os tokens do `*-fundamentos.html` da marca (copie o `:root`) e use as classes do `*-componentes-web.html` correspondente
2. Use `.grid` ou `.grid-N` para layout de página
3. Use `.page-layout` como container principal

---

## DS Gaps conhecidos (junho 2025)

Componentes ainda não documentados no DS Web que podem ser necessários em protótipos:
- Date picker
- File upload
- Rich text editor
- Multi-select com chips
- Tree view / navegação hierárquica
- Wizard / stepper multi-etapas
- Loading states / skeleton screens (CSS classes)
- Spinner component
- Side panel / drawer
- Status timeline / stepper de progresso
- Inline editing em tabelas
- Notification center / panel
- Filtros avançados como componente Web (existe no mapeamento Mendix, mas não como classe CSS web)
- Tabs verticais

Ao encontrar um gap, sinalize no protótipo com `<!-- DS GAP: [componente] -->` e implemente com os tokens existentes mantendo consistência visual. Documente o gap para revisão futura do DS.

---

## Dívida técnica conhecida

### Duplicação por marca
O DS mantém cópias dos mesmos arquivos HTML na raiz, diferenciados por prefixo de marca (`v-`, `a-`, sem prefixo). O que varia entre elas é mínimo: tokens de cor (`--color-primary`, `--color-dark`, `--color-accent`), referência de logo e título.

**Consequência direta:** qualquer correção de bug ou adição de componente precisa ser replicada manualmente nos 3 arquivos equivalentes. Exemplo: ao adicionar um novo componente em `v-componentes-web.html`, o mesmo bloco precisa ir para `a-componentes-web.html` e `componentes-web.html`.

**Checklist de manutenção — ao alterar qualquer arquivo do DS:**

| Arquivo alterado | Replicar em |
|---|---|
| `v-componentes-web.html` | `a-componentes-web.html` · `componentes-web.html` |
| `v-mendix.html` | `a-mendix.html` · `mendix.html` |
| `v-sap-btp.html` | `a-sap-btp.html` · `sap-btp.html` |
| `v-componentes-powerbi.html` | `a-componentes-powerbi.html` · `componentes-powerbi.html` |
| `v-fundamentos.html` | `a-fundamentos.html` · `fundamentos.html` — **atenção: tokens de cor não replicar, são específicos de cada marca** |
| `v-mendix-shell.html` | `a-mendix-shell.html` · `mendix-shell.html` — **atenção: substituir tokens de marca após replicar** |
| `v-sap-shell.html` | `a-sap-shell.html` · `sap-shell.html` — **atenção: substituir tokens de marca após replicar** |

**Solução futura recomendada:** sistema de build simples (ex: script Python ou Node) que mantém um arquivo base por tipo e injeta os tokens de cada marca na geração. Elimina a duplicação sem exigir tooling complexo. Escopo para quando o DS estiver estável e com adoções comprovadas.

---

## Contato

Dúvidas sobre o DS: **Saulo** · Product Designer · Tecnova / GCB
Dúvidas sobre especificação: **Crispim** · Business Analyst · Tecnova / GCB
