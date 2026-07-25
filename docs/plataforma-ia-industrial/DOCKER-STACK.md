# Stack local integrada (App + Nao + Sync)

Sobe o checklist, o agente Nao e a API de sync no mesmo Docker Compose.

## Pré-requisitos

- Docker Desktop rodando
- Arquivo `.env` na raiz (copie de `.env.example`) com `ANTHROPIC_API_KEY=...`
- Portas **8080** (app) e **5005** (Nao) livres

## Subir

```bash
cd /Users/aristotelestn/Projects/projetos-industria

# se já houver container antigo do Nao
docker compose -f docker-compose.nao.yml down 2>/dev/null || true

docker compose up -d --build
```

## URLs

| Serviço | URL |
|---------|-----|
| App (checklist + Nao integrado) | http://localhost:8080 |
| Nao (chat direto) | http://localhost:5005 |
| Health sync | http://localhost:8080/api/health |

## Fluxo integrado

1. Abra o app em **:8080**
2. Avalie empresas → **Sync Nao…** (grava CSVs + DuckDB no volume `nao/`)
3. Use a aba **3. Nao** — chat embutido com painel de contexto (sync, métricas, prompts)

O nginx do app encaminha `/api/nao-sync` para o serviço `sync-api`, que escreve em `./nao/data` e rebuilda `plataforma.duckdb`.

## Parar

```bash
docker compose down
```

## Só o Nao (legado)

```bash
docker compose -f docker-compose.nao.yml up -d
```
