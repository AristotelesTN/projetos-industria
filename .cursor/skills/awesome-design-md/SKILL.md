---
name: awesome-design-md
description: Use curated brand DESIGN.md files from VoltAgent/awesome-design-md when generating or restyling UI. Pick a brand design language, copy its DESIGN.md into the project, and implement UI that matches tokens, layout, and interaction patterns.
---

# Awesome DESIGN.md

Curated [DESIGN.md](https://stitch.withgoogle.com/docs/design-md/overview/) files from [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) — real brand systems for AI UI generation.

## When to use

- Building or restyling pages, dashboards, landing screens, or product UI
- User asks for a look “like Linear / Notion / Stripe / Cursor / …”
- Need consistent tokens, typography, spacing, and component rules

## Library location

- **Cursor (global):** `~/.cursor/awesome-design-md/design-md/<brand>/DESIGN.md`
- **Upstream:** https://github.com/VoltAgent/awesome-design-md

Brands include: linear.app, notion, cursor, stripe, vercel, figma, slack, airtable, raycast, supabase, and many more.

## Workflow

1. Ask which brand language to use (or infer from the request).
2. Read `~/.cursor/awesome-design-md/design-md/<brand>/DESIGN.md` (and its README if present).
3. Copy or symlink that file to the project as `DESIGN.md` (or `docs/DESIGN.md`) when the look should stick for the whole project.
4. Implement UI following that document’s tokens, hierarchy, and constraints — do not invent a conflicting palette.
5. Keep product/brand names and copy belonging to *this* project; only borrow visual language.

## Project notes

- Prefer one active `DESIGN.md` at a time.
- If the repo already has a design system (CSS variables, component kit), merge carefully — DESIGN.md guides look & feel; don’t rip out working structure without asking.
- For this monorepo’s Oficina de Valor UI (Atlassian-like), strong defaults: `linear.app`, `notion`, `airtable`, or `cursor`.
