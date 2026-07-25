# Deploy no Render

Checklist SPA (Vite/React) como **Static Site** no Render.

## Pré-requisitos

1. Repo no GitHub com a pasta `web/` (e `render.yaml` na raiz)
2. Conta em [render.com](https://dashboard.render.com)

## Opção A — Blueprint (recomendado)

1. Push deste repo para `main`
2. No Render: **New → Blueprint** → selecione o repositório
3. Confirme o serviço `plataforma-ia-industrial` do `render.yaml`
4. **Apply**

URL típica: `https://plataforma-ia-industrial.onrender.com`

## Opção B — Manual

1. **New → Static Site**
2. Root Directory: `web`
3. Build Command: `npm ci && npm run build`
4. Publish Directory: `dist`
5. Redirects/Rewrites: `/*` → `/index.html` (Rewrite)

## Variáveis

Static site não precisa de secrets. O chat Nao embutido aponta para `NAO_URL` em `web/public/config.js` (default local). Em produção o painel Nao mostra offline até você hospedar o Nao e atualizar `config.js` / rebuild.

Sync Nao no Render: o app usa **download do pack** (não há `sync-api` no Render free static).

## CLI

```bash
# autenticar
render login

# validar blueprint
render blueprints validate

# ou criar static site via dashboard após o push
```
