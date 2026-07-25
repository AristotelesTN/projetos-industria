# Ruflo (MCP)

[Ruflo](https://github.com/ruvnet/ruflo) — harness multi-agente (swarms, memória, ~100 agents) via MCP no Cursor.

## Configurado

| Onde | Arquivo |
|------|---------|
| Projeto | `.cursor/mcp.json` |
| Global Cursor | `~/.cursor/mcp.json` |

O servidor sobe com:

```bash
npx -y ruflo@latest mcp start
```

`ANTHROPIC_API_KEY` vem do `.env` da raiz do repo.

## Ativar no Cursor

1. Recarregue os MCPs (Command Palette → **MCP: Restart** / reinicie o Cursor)
2. Use **Agent mode** (Ask mode não expõe tools MCP)
3. Confirme o servidor `ruflo` em Settings → MCP

## Init completo no repo (opcional)

Só se quiser o loop completo (`.claude/`, hooks, daemon):

```bash
npx ruflo@latest init wizard
```

Isso altera vários arquivos no workspace — rode só se for intencional.
