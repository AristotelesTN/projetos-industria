# DoseCerta

Assistente de tratamento com lembretes no WhatsApp até a data de fim.

Arquitetura híbrida:

| Camada | Tecnologia |
|---|---|
| Desktop shell | **Electron** |
| Desktop / web UI | **React** + **TypeScript** |
| Mobile | **Expo** (React Native + TypeScript) |
| Backend | **Python 3** + **FastAPI** |
| Dados / Auth / Storage | **Supabase** (**PostgreSQL**) |

## Fluxo do MVP

1. Descreva o tratamento em linguagem natural (desktop, mobile ou WhatsApp)
2. A IA (OpenAI ou parser heurístico) monta o rascunho
3. Você confirma
4. O backend agenda doses e dispara avisos com antecedência até o fim

## Estrutura

```
backend/                 # FastAPI
desktop/                 # Electron + React (Vite)
mobile/                  # Expo (iOS / Android / web)
supabase/migrations/     # Schema Postgres + RLS
```

## Setup

```bash
cp .env.example .env
npm run install:all
npm run dev
```

- API: http://127.0.0.1:8000/api/health  
- UI web (renderer): http://127.0.0.1:5173  
- Desktop: `npm run dev:desktop`  
- Mobile: `npm run dev:mobile` (Expo Go / emulador)

### Mobile em celular físico

1. API escutando em `0.0.0.0:8000` (`npm run dev:api`)
2. No `mobile/.env` ou export:
```bash
EXPO_PUBLIC_API_BASE_URL=http://SEU_IP_LAN:8000/api
```
3. `npm run dev:mobile` e abra no Expo Go

### Supabase

1. Crie um projeto no Supabase
2. Rode `supabase/migrations/20260723010000_init.sql` no SQL Editor
3. Preencha no `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `USE_MEMORY_STORE=false`

Sem credenciais, o backend usa **store em memória**.

### WhatsApp

- `WHATSAPP_PROVIDER=mock` grava mensagens no log
- `WHATSAPP_PROVIDER=meta` usa Cloud API
- Webhook: `GET/POST /api/whatsapp/webhook`

### OpenAI

Com `OPENAI_API_KEY`, o intake usa LLM. Sem chave, usa parser heurístico em português.

## Testes

```bash
npm test
```

## Aviso

DoseCerta é um assistente de lembrete e não substitui orientação médica.
