# Como usar o Nao com a Plataforma IA Industrial

O [Nao](https://github.com/getnao/nao) é um analytics agent open-source. Neste repo ele analisa o checklist multi-fornecedor via DuckDB.

## Stack Docker integrada (app + Nao)

Ver **[DOCKER-STACK.md](./DOCKER-STACK.md)**.

```bash
docker compose up -d --build
# app http://localhost:8080 · nao http://localhost:5005
```

## Sync a partir do app


1. No Checklist → **Avaliar empresa** → crie/edite → **Sincronizar Nao**.
2. Com `npm run dev` na pasta `web/`, a API local grava `nao/data/*.csv`, rebuilda o DuckDB e reinicia o container.
3. Na Vercel (produção), o botão baixa `nao-sync-*.json` + CSVs. Aplique:

```bash
python nao/scripts/apply_sync_payload.py ~/Downloads/nao-sync-YYYY-MM-DD.json
```

## Base mock (50 empresas)

Para popular o DuckDB de teste:

```bash
python nao/scripts/generate_mock_50.py
python nao/scripts/build_duckdb.py
docker compose -f docker-compose.nao.yml restart
```

Gera `empresas`, `avaliacoes` (~4 250 linhas), `empresa_resumo` e views de cobertura.

## Pré-requisitos

- Docker **ou** `pip install nao-core` + chave de LLM
- Python 3.11+ com `pip install duckdb` para gerar a base
- Arquivo `.env` na raiz do repo (copie de `.env.example`) com `ANTHROPIC_API_KEY=...` — **nunca commitar**

## Fluxo rápido

1. No app web (aba **Nao**), clique em **Exportar snapshot Nao**.
2. Substitua o arquivo:

```bash
cp ~/Downloads/avaliacoes-YYYY-MM-DD.csv nao/data/avaliacoes.csv
```

3. Gere o DuckDB:

```bash
pip install duckdb
python nao/scripts/build_duckdb.py
```

4. Suba o chat:

```bash
# Docker
docker compose -f docker-compose.nao.yml up -d

# ou CLI (dentro de nao/)
cd nao
nao sync
nao chat
```

5. Abra a aba **3. Nao** no app (chat integrado) ou http://localhost:5005.

## Embed no app Vite

Crie `web/.env.local`:

```
VITE_NAO_URL=http://localhost:5005
```

Rebuild/redeploy do front se for produção com outra URL pública do Nao.

## Skills do Nao (opcional, no Cursor/Claude)

```bash
npx skills add getnao/nao
```

## Limitações

- O front na Vercel **não** hospeda o Nao (precisa de backend + LLM). Só o checklist e o embed/link.
- Atualize `avaliacoes.csv` + `build_duckdb.py` + `nao sync` sempre que mudar marcações no checklist.
