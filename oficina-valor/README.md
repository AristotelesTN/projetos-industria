# Gestão Oficina de Valor (VMO)

Plataforma high-code de value tracking e governança de portfólio (Stage-Gate G1–G5), com analytics conversacional via Nao/DuckDB.

## Stack

- **API:** NestJS + Prisma + PostgreSQL
- **Web:** React (Vite) + TypeScript (pt-BR / BRL)
- **Analytics:** Nao + DuckDB (snapshot CSV)

## Deploy

- **Render (API + Postgres + static web):** blueprint em [`render.yaml`](render.yaml) — no dashboard Render → *New* → *Blueprint* → aponte para este repo / pasta `oficina-valor`.
- **Vercel (web):** root `oficina-valor/web`, env `VITE_API_URL` = URL da API no Render.
- Demo via túnel (efêmero, enquanto o agent estiver no ar): ver comentário no PR / mensagem do agent.

## Subir localmente

```bash
cp ../.env.example ../.env   # se ainda não existir; adicione ANTHROPIC_API_KEY para o Nao
cd oficina-valor
docker compose up -d --build
```

| Serviço | URL |
|---------|-----|
| Web | http://localhost:3080 |
| API | http://localhost:3001 |
| Nao | http://localhost:5006 |
| Postgres | localhost:5433 |

### Dev sem Docker (API + Web)

```bash
# Postgres em docker
docker compose up -d postgres

cd api && npm install && npx prisma migrate deploy && npm run seed && npm run start:dev
cd web && npm install && npm run dev
```

## Login de desenvolvimento

Use o header `X-Dev-User` com um dos e-mails seed, ou o seletor de persona na UI:

| E-mail | Papel |
|--------|-------|
| admin@oficina.local | Admin |
| vmo@oficina.local | VMO Lead |
| fin@oficina.local | Finanças |
| sponsor@oficina.local | Sponsor |
| pm@oficina.local | PM |
| diretoria@oficina.local | Diretoria |

## Fluxo piloto

1. Login como PM → abrir projeto → registrar medição + evidência
2. Login como Finanças → validar medição → importar custos
3. Ver ROI / curva S no projeto e sumário na Diretoria
4. Sincronizar Nao e perguntar no chat (aba Nao)

## Testes

```bash
cd api && npm test
```
