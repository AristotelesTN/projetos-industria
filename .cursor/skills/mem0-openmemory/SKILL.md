---
name: mem0-openmemory
description: Use Mem0 / OpenMemory MCP tools for persistent cross-session memory in Cursor. WHEN: remember preferences, recall past decisions, save project conventions, "remember this", "what did we decide", memory search.
---

# Mem0 / OpenMemory MCP

## Setup

1. Create an API key at [app.mem0.ai](https://app.mem0.ai).
2. Export it in the shell that launches Cursor:

```bash
export MEM0_API_KEY="m0-..."
```

3. Project MCP config lives in `.cursor/mcp.json` (Mem0 cloud).
4. Restart Cursor → Settings → MCP → confirm `mem0` is connected.

### Optional: OpenMemory (local / sunsetting)

OpenMemory MCP is being sunset by Mem0. Prefer the cloud MCP above, or Mem0 self-hosted (`cd server && make bootstrap` in [mem0](https://github.com/mem0ai/mem0)).

Legacy local stack (needs Docker + `OPENAI_API_KEY`):

```bash
curl -sL https://raw.githubusercontent.com/mem0ai/mem0/main/openmemory/run.sh | OPENAI_API_KEY=sk-... bash
```

Then merge `.cursor/mcp.openmemory.example.json` into `.cursor/mcp.json` (set `OPENMEMORY_USER_ID`, default often your OS username) and restart Cursor.

## When to use tools

If Mem0 MCP tools are available in this session:

- **Before** repeating architecture/preference questions → `search_memories` / `get_memories`
- **After** durable decisions, conventions, or user preferences → `add_memory`
- Prefer concise, factual memories (decision + why), not raw chat dumps
- Scope with the project/user identifiers the tools accept when provided

Do not invent memories if the MCP server is disconnected or the API key is missing — tell the user to set `MEM0_API_KEY` and reconnect MCP.
