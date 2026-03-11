---
name: search-mcp-docs
description: Search the Model Context Protocol specification. Use when implementing MCP clients or servers, understanding the protocol, or checking transport details.
license: ISC
compatibility: Requires bun and network access
allowed-tools: Bash
---

# Search MCP Docs

Query the Model Context Protocol specification via MCP.

## Usage

```bash
bun run skills/search-mcp-docs/scripts/search.ts '{"query": "tools/call request format"}'
```

## Available scripts

- [**scripts/search.ts**](scripts/search.ts) — Search the MCP specification. Takes JSON with `query` and optional `version` fields, prints matching documentation to stdout.

## When to use

- Implementing MCP clients or servers
- Checking JSON-RPC message formats
- Understanding Streamable HTTP transport details
- Looking up tool, resource, or prompt protocol methods
