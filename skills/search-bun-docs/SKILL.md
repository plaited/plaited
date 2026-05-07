---
name: search-bun-docs
description: Search the Bun documentation. Use when answering questions about Bun APIs, runtime features, bundler, test runner, or package manager configuration.
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
        url: https://bun.com/docs/mcp
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
          tool: search_bun
---

# Search Bun Docs

Query the Bun documentation via MCP.

## Usage

```bash
bun run skills/search-bun-docs/scripts/search.ts '{"query": "Bun.file API"}'
```

## Available scripts

- [**scripts/search.ts**](scripts/search.ts) — Search the Bun documentation. Takes JSON with a `query` field, prints matching documentation to stdout.

## When to use

- Looking up Bun runtime APIs (`Bun.file`, `Bun.serve`, `Bun.$`)
- Checking bundler or test runner configuration
- Finding package manager commands or compatibility details
- Verifying Bun-specific behavior vs Node.js
