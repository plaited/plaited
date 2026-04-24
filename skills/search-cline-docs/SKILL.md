---
name: search-cline-docs
description: Search the Cline documentation and read Cline docs pages through the Cline MCP endpoint. Use when answering questions about Cline features, configuration, MCP integration, or CLI/extension behavior.
license: ISC
compatibility: Requires bun and network access
allowed-tools: Bash
---

# Search Cline Docs

Query the Cline documentation via MCP.

## Usage

```bash
bun run skills/search-cline-docs/scripts/search.ts '{"query": "remote MCP servers"}'
```

```bash
bun run skills/search-cline-docs/scripts/query-docs.ts '{"command": "head -120 /mcp/mcp-overview.mdx"}'
```

## Available scripts

- [**scripts/search.ts**](scripts/search.ts) — Search Cline docs (`search_cline`). Takes JSON with `query`.
- [**scripts/query-docs.ts**](scripts/query-docs.ts) — Run read-only docs filesystem queries (`query_docs_filesystem_cline`). Takes JSON with `command`.

## When to use

- Finding Cline docs pages for specific features or workflows
- Looking up exact configuration snippets and MCP setup details
- Reading full docs page content by path when search snippets are insufficient
