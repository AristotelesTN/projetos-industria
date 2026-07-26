# projetos-industria
Projetos Ind�stria

## Mem0 / OpenMemory MCP (Cursor)

Memória persistente para o Cursor Agent via [Mem0 MCP](https://docs.mem0.ai/platform/features/mcp-integration).

1. Crie a chave em https://app.mem0.ai
2. Exporte no shell que inicia o Cursor:

```bash
export MEM0_API_KEY="m0-..."
```

3. O projeto já inclui `.cursor/mcp.json` apontando para `https://mcp.mem0.ai/mcp/`
4. Reinicie o Cursor → Settings → MCP → confirme o servidor `mem0` conectado

Skill: `.cursor/skills/mem0-openmemory/` · Rule: `.cursor/rules/mem0-memory.mdc`

OpenMemory local (legado / em sunset): veja `.cursor/mcp.openmemory.example.json` e o [run.sh](https://github.com/mem0ai/mem0/blob/main/openmemory/run.sh). Preferir Mem0 cloud ou [self-hosted](https://docs.mem0.ai/open-source/overview).

