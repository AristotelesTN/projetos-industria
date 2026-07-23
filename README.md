# DoseCerta

Assistente de tratamento com lembretes no WhatsApp até a data de fim.

Arquitetura híbrida desktop + API + BaaS:

| Camada | Tecnologia |
|---|---|
| Desktop shell | **Electron** |
| UI | **React** + **TypeScript** |
| Backend | **Python 3** + **FastAPI** |
| Dados / Auth / Storage | **Supabase** (**PostgreSQL**) |

## Fluxo do MVP

1. Descreva o tratamento em linguagem natural (app desktop ou WhatsApp)
2. A IA (OpenAI ou parser heurístico) monta o rascunho
3. Você confirma
4. O backend agenda doses e dispara avisos com antecedência até o fim

## Estrutura

```
backend/                 # FastAPI (regras de negócio, intake, scheduler, WhatsApp)
desktop/                 # Electron + React (Vite)
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
- Desktop: `npm run dev:desktop` (abre Electron)

### Supabase

1. Crie um projeto no Supabase
2. Rode `supabase/migrations/20260723010000_init.sql` no SQL Editor
3. Preencha no `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `USE_MEMORY_STORE=false`
4. No desktop, espelhe `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para Auth

Sem credenciais, o backend usa **store em memória** (ótimo para demo local).

### WhatsApp

- `WHATSAPP_PROVIDER=mock` grava mensagens no log (visível no app)
- `WHATSAPP_PROVIDER=meta` usa Cloud API (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`)
- Webhook: `GET/POST /api/whatsapp/webhook`

### OpenAI

Com `OPENAI_API_KEY`, o intake usa LLM. Sem chave, usa parser heurístico em português.

## Testes

```bash
npm test
```

## Aviso

DoseCerta é um assistente de lembrete e não substitui orientação médica.
