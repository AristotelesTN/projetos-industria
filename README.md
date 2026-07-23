# DoseCerta

MVP para lembrar de tomar remédios com avisos no WhatsApp até o fim do tratamento.

Você descreve o tratamento em **linguagem natural** (no site ou no WhatsApp). A IA monta o rascunho; depois de confirmar, o app agenda as doses e dispara lembretes com antecedência.

## O que entra no MVP

- Entrada no **app web** e no **WhatsApp**
- Tratamentos com **data de fim** (obrigatória)
- Parse por IA (`OPENAI_API_KEY`) com **fallback heurístico** em português
- Preview + confirmação antes de ativar
- Alertas com antecedência + respostas `TOMEI` / `ADIAR`
- Provider WhatsApp `mock` (log local) ou `meta` (Cloud API)

## Stack

- Next.js (App Router) + TypeScript
- Prisma 7 + SQLite
- Zod + OpenAI SDK
- Vitest

## Setup

```bash
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Variáveis

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | SQLite (`file:./prisma/dev.db`) |
| `DEFAULT_USER_PHONE` | Telefone padrão do app |
| `DEFAULT_TIMEZONE` | Ex.: `America/Sao_Paulo` |
| `WHATSAPP_PROVIDER` | `mock` ou `meta` |
| `OPENAI_API_KEY` | Opcional; sem ela usa parser heurístico |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | Cloud API Meta |
| `WHATSAPP_VERIFY_TOKEN` | Verificação do webhook |

## Fluxos

### App

1. Descreva o tratamento na home
2. Revise o rascunho gerado pela IA
3. Confirme para gerar doses e ativar alertas

### WhatsApp

- Webhook: `GET/POST /api/whatsapp/webhook`
- Simulação local:

```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H 'content-type: application/json' \
  -d '{"from":"5511999999999","text":"Amoxicilina 500mg de 8 em 8 horas por 7 dias, às 14h, avisa 15 min antes."}'
```

Respostas úteis: `CONFIRMAR`, `CANCELAR`, `TOMEI`, `ADIAR`.

### Scheduler

A home chama `/api/scheduler/tick` a cada 30s enquanto aberta. Em produção, use cron:

```bash
npm run reminders:tick
# ou
curl -X POST http://localhost:3000/api/scheduler/tick
```

## Testes

```bash
npm test
```

## Aviso

DoseCerta é um assistente de lembrete. Não substitui orientação médica.
