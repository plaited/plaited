---
name: search-bun-docs
description: Search the Bun documentation. Use when answering questions about Bun APIs, runtime features, bundler, test runner, or package manager configuration.
license: ISC
compatibility: Requires `plaited` CLI and network access
allowed-tools: Bash
---

# Search Bun Docs

Query the Bun documentation via MCP.

## Usage

```bash
plaited mcp-client '{"mode":"call-tool","url":"https://bun.com/docs/mcp","tool":"search_bun","args":{"query":"Bun.file API"}}'
```

## When to use

- Looking up Bun runtime APIs (`Bun.file`, `Bun.serve`, `Bun.$`)
- Checking bundler or test runner configuration
- Finding package manager commands or compatibility details
- Verifying Bun-specific behavior vs Node.js

## See also

- `plaited mcp-client --help` — discover all available MCP operations
- `plaited mcp-client --schema input` — inspect the full input schema
