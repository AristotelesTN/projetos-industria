# Deploy no Render

Checklist SPA (Vite/React) como **Static Site** no Render.

## Live

**https://plataforma-ia-industrial.onrender.com**

Dashboard: https://dashboard.render.com/static/srv-d9ihjm58nd3s739uqel0

## Pré-requisitos

1. Repo no GitHub com a pasta `web/` (e `render.yaml` na raiz)
2. Conta em [render.com](https://dashboard.render.com)

## Opção A — Blueprint (recomendado)

1. Push deste repo para `main`
2. No Render: **New → Blueprint** → selecione o repositório
3. Confirme o serviço `plataforma-ia-industrial` do `render.yaml`
4. **Apply**

## Opção B — CLI

```bash
render login
render workspace set <workspace-id>
render services create \
  --name plataforma-ia-industrial \
  --type static_site \
  --repo https://github.com/AristotelesTN/projetos-industria \
  --branch main \
  --root-directory web \
  --build-command "npm ci && npm run build" \
  --publish-directory dist \
  --confirm
```

## Variáveis

Static site não precisa de secrets. O chat Nao embutido aponta para `NAO_URL` em `web/public/config.js` (default local). Em produção o painel Nao fica offline até hospedar o Nao e atualizar `config.js`.

Sync Nao no Render: o app usa **download do pack** (não há `sync-api` no static site).
