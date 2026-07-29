# Gestão Oficina de Valor (VMO)

Plataforma high-code de value tracking e governança de portfólio (Stage-Gate G1–G5), com analytics conversacional via motor nativo / DuckDB.

## Stack

- **API:** NestJS + Prisma + PostgreSQL
- **Web:** React (Vite) + TypeScript (pt-BR / BRL)
- **Analytics:** Insights nativo (API) + snapshot CSV opcional

## Deploy local (sua máquina)

Requisitos: [Docker Desktop](https://www.docker.com/products/docker-desktop/) (ou Docker Engine + Compose v2).

```bash
git clone https://github.com/AristotelesTN/projetos-industria.git
cd projetos-industria
git checkout cursor/oficina-valor-mvp-604b   # ou main, quando mergeado

cd oficina-valor
docker compose up -d --build
```

Aguarde ~1–2 min na primeira vez (build + migrate + seed).

| Serviço | URL |
|---------|-----|
| **App (web)** | http://localhost:3080 |
| API | http://localhost:3001 |
| Postgres | localhost:5433 |

**Login:** na tela inicial, use `gerente@oficina.local` (modo dev).

### Comandos úteis

```bash
docker compose ps          # status
docker compose logs -f api # logs da API
docker compose down        # parar
docker compose down -v     # parar e apagar dados do Postgres
```

### Dev sem Docker (API + Web)

```bash
docker compose up -d postgres
cd api && npm install && npx prisma migrate deploy && npm run seed && npm run start:dev
cd web && npm install && npm run dev
```

Web dev: http://localhost:5173 → API em http://localhost:3001.

## Deploy nuvem (opcional)

- **Render (API + Postgres + static web):** blueprint em [`render.yaml`](render.yaml) — dashboard Render → *New* → *Blueprint* → pasta `oficina-valor`. Depois defina `VITE_API_URL` (URL da API) no serviço web e `CORS_ORIGIN` na API.

## Login de desenvolvimento

| E-mail | Papel |
|--------|-------|
| gerente@oficina.local | Gerente de Portfólio |

Botão único na tela de login, ou header `X-Dev-User: gerente@oficina.local`.

## Fluxo piloto

1. **Demandas** → registrar oportunidade → entrevista de ganhos → priorizar → go/no-go → criar projeto
2. **Portfólio** → abrir projeto → decisão go/no-go, memória/OPEX, avaliação
3. Wizard de ganhos → homologar medições
4. Encerrar projeto → acompanhamento pós (Wizard realização)
5. Analytics / Insights → Gerar Story

## Testes

```bash
cd api && npm test
```
