# Agent notes

## gstack (Cursor)

[garrytan/gstack](https://github.com/garrytan/gstack) is installed for Cursor.

- **Global (full suite):** `~/.cursor/skills/gstack` + `~/.cursor/skills/gstack-*` (generated with `bun run gen:skill-docs --host cursor`)
- **Repo:** thin router skill at `.agents/skills/gstack` / `.cursor/skills/gstack` (see `skills-lock.json`)

Common commands: `/office-hours`, `/autoplan`, `/review`, `/qa`, `/ship`, `/cso`, `/gstack`.

Refresh global install:

```bash
export PATH="$HOME/.bun/bin:$PATH"
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/gstack
cd ~/gstack && bun install && bun run gen:skill-docs --host cursor
# link ~/gstack/.cursor/skills/gstack-* → ~/.cursor/skills/
```

## Karpathy guidelines

`.cursor/rules/karpathy-guidelines.mdc` (`alwaysApply: true`).
