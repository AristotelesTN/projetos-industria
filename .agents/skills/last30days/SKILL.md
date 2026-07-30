---
name: last30days
description: Research what people actually say about any topic in the last 30 days across Reddit, X, YouTube, TikTok, Hacker News, Polymarket, GitHub, and the web. Use for recent sentiment, reactions, and discourse. Includes a doctor health check for sources.
---

# last30days

Thin router to the global install from [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill).

## Location

- **Global (full skill):** `~/.cursor/skills/last30days` (also `~/.agents/skills/last30days`)
- **Upstream:** https://github.com/mvanhorn/last30days-skill

## When to use

- User asks what people are saying about a topic recently / in the last 30 days
- Sentiment, reactions, discourse across social + web sources
- `last30days <topic>` or “what’s the reaction to …”

## Workflow

1. Read `~/.cursor/skills/last30days/SKILL.md` and follow it.
2. Prefer the bundled scripts under `~/.cursor/skills/last30days/scripts/` when the skill requires them.
3. Optional API keys (ScrapeCreators, OpenAI, xAI, etc.) unlock more sources — see skill metadata.

## Refresh

```bash
npx skills add mvanhorn/last30days-skill -g
# ensure Cursor path:
cp -a ~/.agents/skills/last30days ~/.cursor/skills/last30days
```
