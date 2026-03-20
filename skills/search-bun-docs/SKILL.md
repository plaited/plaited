---
name: search-bun-docs
description: Search the Bun documentation. Use when answering questions about Bun APIs, runtime features, bundler, test runner, or package manager configuration.
license: ISC
compatibility: Requires bun and network access
allowed-tools: Bash
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
