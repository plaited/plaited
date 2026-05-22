---
name: search-agent-skills
description: Search the AgentSkills specification. Use when creating, validating, structuring skills, or understanding the SKILL.md format.
license: ISC
compatibility: Requires `plaited` CLI and network access
allowed-tools: Bash
---

# Search Agent Skills

Query the AgentSkills specification via MCP.

## Usage

```bash
plaited mcp-client '{"mode":"call-tool","url":"https://agentskills.io/mcp","tool":"search_agent_skills","args":{"query":"SKILL.md frontmatter fields"}}'
```

## When to use

- Creating new skills (frontmatter format, directory structure)
- Validating skill directories
- Understanding scripts/, references/, assets/ conventions
- Checking AgentSkills client implementation guidance

## See also

- `plaited mcp-client --help` — discover all available MCP operations
- `plaited mcp-client --schema input` — inspect the full input schema
