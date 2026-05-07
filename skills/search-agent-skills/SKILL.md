---
name: search-agent-skills
description: Search the AgentSkills specification. Use when creating, validating, structuring skills, or understanding the SKILL.md format.
license: ISC
compatibility: Requires bun and network access
allowed-tools: Bash
metadata:
  plaited:
    kind: generated-skill
    origin:
      kind: generated
      source:
        type: remote-mcp
        url: https://agentskills.io/mcp
    capabilities:
      - id: docs.search
        type: cli
        lane: private
        phase: context
        audience: [analyst]
        actions: [search, read]
        sideEffects: network
        handler:
          type: cli
          command: scripts/search.ts
        source:
          type: remote-mcp
          tool: search_agent_skills
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
