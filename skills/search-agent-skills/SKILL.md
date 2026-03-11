---
name: search-agent-skills
description: Search the AgentSkills specification. Use when creating, validating, structuring skills, or understanding the SKILL.md format.
license: ISC
compatibility: Requires bun and network access
allowed-tools: Bash
---

# Search Agent Skills

Query the AgentSkills specification via MCP.

## Usage

```bash
bun run skills/search-agent-skills/scripts/search.ts '{"query": "SKILL.md frontmatter fields"}'
```

## Available scripts

- [**scripts/search.ts**](scripts/search.ts) — Search the AgentSkills specification. Takes JSON with a `query` field, prints matching documentation to stdout.

## When to use

- Creating new skills (frontmatter format, directory structure)
- Validating skill directories
- Understanding scripts/, references/, assets/ conventions
- Checking AgentSkills client implementation guidance
