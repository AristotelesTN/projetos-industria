# Como usar — Planilha e Notion

Arquivos em `docs/plataforma-ia-industrial/`:

| Arquivo | Uso |
|---------|-----|
| `checklist-planilha.csv` | Google Sheets / Excel (itens dos 7 pilares) |
| `checklist-inventario.csv` | Aba/arquivo separado do inventário S.1–S.9 |
| `checklist-notion.csv` | Importação como database no Notion |

## Valores padronizados

**Cobertura (Fornecedor A/B/C):** `—` · `Não tem` · `Parcial` · `Tem`

**Roadmap:** `—` · `Backlog` · `Em curso` · `Feito`

**Decisão:** `—` · `Comprar` · `Construir` · `Híbrido` · `Adiar`

**Cobertura ponderada:** `(#Tem + 0.5 × #Parcial) / total`

Renomeie as colunas/fornecedores A/B/C para os nomes reais (Azure, AWS, Databricks, etc.).

---

## Google Sheets

1. Abra [Google Sheets](https://sheets.google.com) → **Arquivo** → **Importar** → **Upload**.
2. Envie `checklist-planilha.csv` (separador: vírgula; codificação UTF-8).
3. Opcional: importe `checklist-inventario.csv` em uma **nova aba**.
4. Selecione as colunas de cobertura/roadmap/decisão → **Dados** → **Validação de dados** → Lista de itens com os valores acima.
5. **Compartilhar** o link com a equipe (qualquer computador com a conta Google).

### Fórmula de cobertura (exemplo para Fornecedor A)

Com a coluna E = cobertura do fornecedor A, a partir da linha 2:

```text
=(CONT.SE(E2:E;"Tem")+0,5*CONT.SE(E2:E;"Parcial"))/CONT.VALORES(E2:E)
```

(Em Sheets em inglês: `COUNTIF` / `COUNTA`.)

---

## Excel / Excel Online

1. Abra Excel → **Dados** → **Obter dados** → **De arquivo** → **Do texto/CSV**.
2. Selecione `checklist-planilha.csv` (UTF-8).
3. Use **Validação de dados** nas colunas de status.
4. Salve no OneDrive/SharePoint e compartilhe o link.

---

## Notion

1. No Notion: **Add a page** → **Table** → **Import** → **CSV**  
   (ou `/import` → CSV).
2. Envie `checklist-notion.csv`.
3. A coluna **Name** vira o título da página; as demais viram propriedades.
4. Ajuste tipos de propriedade:
   - **Pilar**, **Tipo**, **Roadmap**, **Decisão**, **Fornecedor A/B/C** → *Select*
   - **Descrição**, **Notas**, **Resposta inventário** → *Text*
   - **ID** → *Text* (ou *Select*)
5. Crie views úteis:
   - Board agrupado por **Decisão**
   - Table filtrada por **Pilar**
   - Table “Gaps” onde A/B/C = `Não tem` ou `—`
6. Compartilhe a página Notion com a equipe (acesso via navegador em qualquer PC).

Dica: no Notion, após importar, edite as opções dos Selects para bater exatamente com a legenda (Tem / Parcial / Não tem / —).

---

## Manutenção

- Fonte no git: estes CSVs + `checklist.md`.
- Depois de mudanças grandes na spec, regenere os CSVs a partir do design/checklist (peça ao agente para atualizar).
