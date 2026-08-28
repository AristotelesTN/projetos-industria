# gcb-ds — Fio · Tecnova (local com Docker)

Cópia local do [Design System GCB](https://gcb-ds.netlify.app) servida em container nginx.

## Pré-requisitos

- Docker Desktop ou Docker Engine + Compose
- `wget`

## Uso rápido

```bash
# Baixar/atualizar o site da Netlify
./scripts/mirror.sh

# Subir container
docker compose up --build -d

# Acessar
open http://localhost:8081
```

## Comandos úteis

```bash
docker compose logs -f gcb-ds   # logs
docker compose down             # parar
docker compose restart          # reiniciar após mirror.sh
```

## Atualizar cópia

Quando o site online mudar:

```bash
./scripts/mirror.sh
docker compose restart
```

## Estrutura

```text
gcb-ds/
├── site/              # HTML + assets (gerado por mirror.sh)
├── scripts/mirror.sh  # espelha gcb-ds.netlify.app
├── nginx.conf         # URLs limpas (/ds → ds.html)
├── Dockerfile
└── docker-compose.yml # porta 8081 (8080 costuma estar em uso)
```

## Notas

- Fontes (Inter) e ícones (Phosphor) vêm de CDN — requer internet no navegador.
- Para o repo Git oficial do GCB/Tecnova, contate sd@gcb.com.br.
