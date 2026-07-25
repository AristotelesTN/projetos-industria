# Design: Checklist — Plataforma IA Industrial

**Data:** 2026-07-23  
**Status:** Aguardando revisão do usuário  
**Objetivos de uso:** (A) avaliar fornecedores/plataformas · (C) roadmap de construção  
**Marcação por item:** cobertura **por fornecedor** (multi-vendor) + status roadmap + decisão buy/build  
**Entrega:** canvas interativo no Cursor + Markdown versionável no repo

---

## 1. Problema

A organização precisa de um artefato único para:

1. Avaliar e **comparar lado a lado** o que vários fornecedores/plataformas cobrem frente ao que se espera de uma Plataforma IA Industrial.
2. Decidir e acompanhar o que comprar, construir, hibridizar ou adiar no roadmap interno (decisão única por item, informada pela comparação).

O conteúdo de referência já está definido nos 7 pilares + síntese de inventário de agentes.

## 2. Escopo

### Dentro

- Checklist completa dos 7 pilares (expectativas + funcionalidades avançadas).
- Bloco final de inventário/síntese (9 perguntas) — escopo interno, sem colunas de fornecedor.
- Por item (pilares 1–7): tipo, **cobertura por cada fornecedor**, estágio do roadmap, decisão.
- **Comparação multi-fornecedor** (3 slots na v1; nomes editáveis).
- Canvas interativo (filtros + progresso por fornecedor + ranking) e Markdown no repo.
- Resumo comparativo: cobertura ponderada por fornecedor e por pilar.

### Fora (YAGNI)

- Mais de 3 fornecedores na UI padrão (pode-se duplicar o doc se precisar de 4+).
- Sync automático canvas → git.
- Scores ponderados por peso de item (todos os itens pesam igual).
- Integração com ferramentas de PM (Jira, etc.).

## 3. Modelo de dados

### 3.1 Fornecedores (nível documento)

| Campo | Valores |
|-------|---------|
| `vendors` | Lista de 3 entradas `{ id, nome }` |
| `id` | Estável: `v1`, `v2`, `v3` |
| `nome` | Editável (ex.: `Azure AI`, `AWS`, `Databricks`) — default: `Fornecedor A/B/C` |

### 3.2 Item da checklist

| Campo | Valores |
|-------|---------|
| `id` | Identificador estável (ex.: `1.1`, `1.A1`) |
| `pilar` | 1…7 + `sintese` |
| `tipo` | `Expectativa` \| `Avançado` \| `Inventario` |
| `texto` | Descrição do item |
| `coberturas` | Mapa `vendorId → (— \| Não tem \| Parcial \| Tem)` |
| `roadmap` | `—` \| `Backlog` \| `Em curso` \| `Feito` (único, org) |
| `decisao` | `—` \| `Comprar` \| `Construir` \| `Híbrido` \| `Adiar` (único, org) |
| `notas` | Texto livre (Markdown; opcional no canvas) |

Convenção de IDs:

- Expectativas do pilar N: `N.1`, `N.2`, …
- Avançados do pilar N: `N.A1`, `N.A2`, …
- Inventário: `S.1` … `S.9`

**Regra:** `roadmap` e `decisao` são da organização (não por fornecedor). A comparação de `coberturas` informa a `decisao` (ex.: Comprar no que o vencedor cobre; Construir no gap comum).

## 4. Conteúdo — itens

### Pilar 1 — Dados e camada de contexto

**Objetivo:** Ingestão, normalização e integração das fontes corporativas para contextualizar agentes e apps de IA.

**Expectativas**

| ID | Item |
|----|------|
| 1.1 | Conectores pré-construídos para aplicações e sistemas corporativos |
| 1.2 | Integração com sistemas de registro (ERP, CRM, MES, CMMS, data platforms) |
| 1.3 | Pipelines robustos de ingestão, tratamento e normalização |
| 1.4 | Controle de acesso baseado em funções para pessoas e agentes |
| 1.5 | Cache de memória e reutilização de contexto entre interações |

**Avançados**

| ID | Item |
|----|------|
| 1.A1 | Knowledge graph e mecanismo de contexto corporativo |
| 1.A2 | Taxonomias e ontologias por indústria/domínio |
| 1.A3 | Melhoria automática de qualidade, consistência e enriquecimento |
| 1.A4 | Memória persistente e compartilhamento de contexto entre agentes |
| 1.A5 | Enriquecimento dos agentes com conhecimento corporativo e domínio |

### Pilar 2 — Desenvolvimento

**Objetivo:** Ferramentas, frameworks e ambientes para desenvolver agentes, copilotos e aplicações.

**Expectativas**

| ID | Item |
|----|------|
| 2.1 | Agent Studio com interface em linguagem natural |
| 2.2 | Suporte low-code e code-first |
| 2.3 | Modelos reutilizáveis de agentes e fluxos de trabalho |
| 2.4 | Engenharia de prompts e configuração de instruções de sistema |
| 2.5 | Raciocínio em múltiplas etapas e ciclos de execução |
| 2.6 | Independência de modelo via hub de LLMs |

**Avançados**

| ID | Item |
|----|------|
| 2.A1 | Combinação de LLMs com regras, algoritmos e componentes determinísticos |
| 2.A2 | Integração com assistentes de desenvolvimento nativos ou de terceiros |
| 2.A3 | Lógica de negócio específica por processo/domínio |
| 2.A4 | Frameworks avançados (consenso, agent-as-a-judge) |
| 2.A5 | Otimização automática de seleção, execução e desempenho dos modelos |

### Pilar 3 — Testes e avaliação

**Objetivo:** Avaliar desempenho, precisão, confiabilidade e efetividade dos agentes.

**Expectativas**

| ID | Item |
|----|------|
| 3.1 | Ambiente sandbox para testes controlados |
| 3.2 | Human-in-the-Loop |
| 3.3 | KPIs específicos por agente/caso de uso |
| 3.4 | Avaliação e pontuação contínua dos resultados |
| 3.5 | Monitoramento em produção e refinamento contínuo |

**Avançados**

| ID | Item |
|----|------|
| 3.A1 | Testes baseados em personas, casos de uso e intenções |
| 3.A2 | Simulação de situações reais e testes de estresse |
| 3.A3 | LLM-as-a-judge |
| 3.A4 | Comparação champion/challenger |
| 3.A5 | Implantação gradual (recomendação → copiloto → automação → autonomia) |

### Pilar 4 — Implantação

**Objetivo:** Infraestrutura e processos para colocar apps e agentes em produção.

**Expectativas**

| ID | Item |
|----|------|
| 4.1 | Implantação cloud, edge, local ou híbrida |
| 4.2 | Conectores/padrões para integrar agentes aos sistemas corporativos |
| 4.3 | Governança consistente independente do ambiente de execução |
| 4.4 | Integração com APIs, sistemas de registro e fluxos existentes |
| 4.5 | Gestão de versões, ambientes e configurações |

**Avançados**

| ID | Item |
|----|------|
| 4.A1 | Integração nativa com plataformas externas de agentes/dev |
| 4.A2 | Incorporação direta dos agentes aos processos corporativos |
| 4.A3 | Monitoramento contínuo das aplicações em produção |
| 4.A4 | Alertas de degradação e model drift |
| 4.A5 | Diagnóstico de causa raiz para falhas agentic |

### Pilar 5 — Orquestração

**Objetivo:** Coordenar fluxos entre modelos, ferramentas, agentes, APIs e sistemas.

**Expectativas**

| ID | Item |
|----|------|
| 5.1 | Orquestrador baseado em LLM capaz de decompor tarefas |
| 5.2 | Distribuição de carga e direcionamento de atividades |
| 5.3 | Coordenação entre múltiplos agentes |
| 5.4 | Pontos de aprovação e controle humano |
| 5.5 | Camada compartilhada de memória e contexto corporativo |
| 5.6 | Roteamento e abstração entre diferentes LLMs |

**Avançados**

| ID | Item |
|----|------|
| 5.A1 | Orquestração de agentes, subagentes e sistemas de terceiros |
| 5.A2 | Transferência de tarefas e contexto entre agentes |
| 5.A3 | Memória persistente entre sessões |
| 5.A4 | Otimização proativa dos fluxos de trabalho |
| 5.A5 | Roteamento dinâmico de modelos e gestão de cargas |
| 5.A6 | Redes dinâmicas de agentes conforme a necessidade |

### Pilar 6 — Governança e controle

**Objetivo:** Políticas, segurança, conformidade, monitoramento e gestão de riscos.

**Expectativas**

| ID | Item |
|----|------|
| 6.1 | Plano de controle centralizado para agentes e aplicações |
| 6.2 | Visibilidade sobre agentes, ferramentas, modelos e acessos |
| 6.3 | Logs de auditoria, rastreabilidade e transparência |
| 6.4 | RBAC para pessoas e agentes |
| 6.5 | Pontuação de confiança para resultados e fluxos agentic |
| 6.6 | Controle de custos (roteamento de modelos e gestão de contexto) |

**Avançados**

| ID | Item |
|----|------|
| 6.A1 | Acompanhamento de ROI das aplicações de IA |
| 6.A2 | Regras comuns de governança para agentes internos e de terceiros |
| 6.A3 | Controle granular por usuário, agente, aplicação e ambiente |
| 6.A4 | Monitoramento contínuo dos fluxos dos agentes |
| 6.A5 | Descoberta, identificação, pesquisa e catalogação de agentes |
| 6.A6 | Registro de endpoints, ferramentas, modelos, dados e permissões |
| 6.A7 | Gestão centralizada do ciclo de vida e da frota de agentes |

### Pilar 7 — Aplicações e serviços

**Objetivo:** Experiência final (chatbots, copilotos, apps de negócio, soluções personalizadas).

**Expectativas**

| ID | Item |
|----|------|
| 7.1 | Marketplace de agentes e componentes pré-construídos |
| 7.2 | Integração nativa de aplicações de terceiros |
| 7.3 | Arquitetura para entrega, implantação e sustentação |
| 7.4 | Suporte de especialistas, arquitetos e equipes de implantação |
| 7.5 | Componentes reutilizáveis para acelerar casos de uso |

**Avançados**

| ID | Item |
|----|------|
| 7.A1 | Fluxos específicos por indústria e processo |
| 7.A2 | Aplicações replicáveis com arquiteturas otimizadas |
| 7.A3 | Skills pré-construídas incorporáveis aos agentes |
| 7.A4 | Modelos especializados/ajustados por domínio |
| 7.A5 | Serviços para manutenção, qualidade, produção, energia, logística, segurança |

### Síntese — inventário organizacional

| ID | Pergunta |
|----|----------|
| S.1 | Quais agentes existem? |
| S.2 | Onde estão sendo executados? |
| S.3 | Quem é responsável por cada agente? |
| S.4 | Quais dados, APIs e ferramentas podem acessar? |
| S.5 | Quais modelos utilizam? |
| S.6 | Como estão performando? |
| S.7 | Quanto estão custando? |
| S.8 | Quais riscos apresentam? |
| S.9 | Qual valor geram para o negócio? |

Para S.\*: sem colunas de fornecedor. Markdown: Resposta + Roadmap + Decisão + Notas. Canvas: inventário com nota/resposta.

## 5. Entregáveis

### 5.1 Markdown (fonte oficial)

Path: `docs/plataforma-ia-industrial/checklist.md`

- Metadados no topo: data, responsável, nomes dos 3 fornecedores (`v1`/`v2`/`v3`).
- Legenda: valores de cobertura, roadmap e decisão.
- **Tabela-resumo comparativa** no topo: cobertura ponderada (%) por fornecedor (total + por pilar).
- Uma tabela por pilar com colunas:

  `| ID | Item | Tipo | v1 (nome) | v2 (nome) | v3 (nome) | Roadmap | Decisão | Notas |`

- Valores iniciais: `—` nas coberturas / roadmap / decisão.
- Tabela de inventário (S.\*) sem colunas de vendor.

### 5.2 Canvas (trabalho interativo)

Path: `/Users/aristotelestn/.cursor/projects/Users-aristotelestn-Projects-projetos-industria/canvases/plataforma-ia-industrial-checklist.canvas.tsx`

- Campos para editar os **3 nomes de fornecedor**.
- Cards de ranking: cobertura ponderada por fornecedor (total).
- Heatmap / barras de cobertura **por pilar × fornecedor**.
- Tabela por pilar: uma coluna de cobertura por vendor + roadmap + decisão (editáveis na sessão).
- Filtros: pilar, tipo, decisão; filtro “onde vendor X é melhor / único Tem / todos Não tem” (gaps comuns).
- Sem sync automático com o Markdown.

## 6. Métricas

Por cada fornecedor `v` (itens dos pilares 1–7 apenas):

- **Cobertura ponderada:** `(#Tem + 0.5 × #Parcial) / total`
- **Cobertura por pilar:** mesma fórmula restrita ao pilar

Organizacionais:

- **Roadmap:** `% Feito / total` (itens 1–7)
- **Decisões:** contagem Comprar / Construir / Híbrido / Adiar / sem decisão

Comparativos derivados (canvas):

- **Líder por item:** vendor(s) com melhor status (`Tem` > `Parcial` > `Não tem` > `—`)
- **Gap comum:** itens em que todos os vendors são `Não tem` ou `—` → candidatos naturais a **Construir**
- **Empate/parcial:** itens sem `Tem` claro → candidatos a **Híbrido** ou aprofundar RFP

## 7. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Canvas e Markdown divergem | Markdown é fonte oficial; canvas = rascunho de sessão |
| Tabelas largas demais (3 vendors) | 3 slots fixos; nomes curtos; filtros por pilar |
| Decisão confundida com “qual vendor ganhou” | `decisao` é buy/build org; ranking é só cobertura |
| Itens ambíguos entre pilares | IDs estáveis; texto fiel à fonte original |

## 8. Critérios de aceite

1. Todos os itens da fonte original estão presentes com IDs estáveis.
2. Markdown com 3 colunas de cobertura por fornecedor + tabela-resumo comparativa.
3. Canvas com nomes editáveis, ranking por cobertura, progresso por pilar×vendor e edição local.
4. Inventário S.\* sem colunas de fornecedor.
5. Legenda e metadados (data, responsável, nomes dos vendors) no Markdown.

## 9. Próximo passo

Após aprovação desta spec pelo usuário → skill **writing-plans** → implementação canvas + markdown.
