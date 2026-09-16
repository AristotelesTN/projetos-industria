# VIVIX AgentHub — protótipo local

Snapshot do Figma Make publicado em [mild-sesame-09528810.figma.site](https://mild-sesame-09528810.figma.site/) (11/09/2026), com tokens visuais alinhados ao [Design System VIVIX](https://gcb-ds.netlify.app/v-fundamentos) (`vivix-ds.css` + paleta no bundle).

Não é o shell VolundOS da spec em `docs/volundos-figma-spec/`. É o dashboard operacional: monitoramento, catálogo, playground, custos, governança.

## Subir

```bash
cd prototipo-agenthub
python3 serve.py
```

Abre [http://127.0.0.1:4177/](http://127.0.0.1:4177/). Deep links (`/registry`, `/playground`, …) também funcionam.

Rotas (mesmo app, client-side):

| Caminho | Tela |
|---|---|
| `/` | Dashboard |
| `/agents` | Monitoramento |
| `/registry` | Catálogo de Agentes |
| `/catalog` | MCP · Tools · Skills |
| `/playground` | Playground |
| `/costs` | Custos & ROI |
| `/governance` | Governança |
| `/leaderboard` | Leaderboard |
| `/changelog` | Changelog |
| `/settings` | Configurações |

Fonte das telas: bundle Figma Make `8ca508bf…` (criação 11/09/2026 16:38 UTC). Para atualizar depois de republicar o Make, baixe de novo o HTML, `_runtimes/`, `_components/v2/` e `_json/` do `.figma.site`.
