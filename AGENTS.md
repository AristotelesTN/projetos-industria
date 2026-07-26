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

## Awesome DESIGN.md

[VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) — curated brand `DESIGN.md` files for AI UI generation.

- **Global library:** `~/.cursor/awesome-design-md/design-md/<brand>/DESIGN.md`
- **Skill:** `.agents/skills/awesome-design-md` / `.cursor/skills/awesome-design-md`
- **Rule:** `.cursor/rules/awesome-design-md.mdc`

Refresh:

```bash
git clone --single-branch --depth 1 https://github.com/VoltAgent/awesome-design-md.git ~/.cursor/awesome-design-md
# or: cd ~/.cursor/awesome-design-md && git pull
```

## last30days

[mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) — research what people say about a topic in the last 30 days (Reddit, X, YouTube, TikTok, HN, Polymarket, GitHub, web).

- **Global:** `~/.cursor/skills/last30days` (+ `~/.agents/skills/last30days`)
- **Repo:** thin router at `.agents/skills/last30days` / `.cursor/skills/last30days`

Refresh:

```bash
npx skills add mvanhorn/last30days-skill -g
cp -a ~/.agents/skills/last30days ~/.cursor/skills/last30days
```
