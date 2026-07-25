# Hospedar a checklist na Vercel

App em `web/` (Vite + React). Build estático → qualquer URL pública.

## Pré-requisitos

1. Conta em [vercel.com](https://vercel.com) (login com GitHub é o mais simples)
2. Node 20+ local (só se for testar/deploy pelo CLI)
3. Repo no GitHub (recomendado) **ou** deploy direto pela pasta `web/`

## Opção A — Deploy pelo GitHub (recomendado)

1. Faça push deste repositório para o GitHub.
2. Em [vercel.com/new](https://vercel.com/new):
   - **Import** o repositório
   - **Root Directory:** `web`
   - Framework: Vite (detecta sozinho)
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. **Deploy**
4. Use a URL gerada (ex.: `https://plataforma-ia-industrial-….vercel.app`) em qualquer computador.

Atualizações: cada `git push` na branch conectada republica automaticamente.

## Opção B — Deploy pelo CLI

```bash
cd web
npm install
npm run build          # confere se builda localmente
npx vercel login
npx vercel             # preview
npx vercel --prod      # produção
```

Na primeira vez o CLI pergunta o root — confirme que é a pasta `web` (ou rode os comandos já dentro de `web/`).

## Opção C — Arrastar a pasta (sem Git)

1. `cd web && npm install && npm run build`
2. No dashboard Vercel → **Add New…** → **Project** → upload / CLI com a pasta `web/dist`  
   (para Vite, o fluxo usual ainda é Opção A ou B; upload de `dist` puro também funciona como “static site”).

## O que a app faz / não faz

| Faz | Não faz |
|-----|---------|
| Checklist multi-vendor no browser | Login / multi-usuário |
| Salva marcações no `localStorage` | Sync entre PCs (cada browser tem o seu estado) |
| URL pública | Backend / banco |

Se precisar do **mesmo preenchimento** em vários PCs, use a planilha/Notion em paralelo, ou peça depois autenticação + banco.

## Teste local

```bash
cd web
npm install
npm run dev
```

Abra a URL do Vite (geralmente `http://localhost:5173`).
