---
name: search-mcp-docs
description: Search the Model Context Protocol specification. Use when implementing MCP clients or servers, understanding the protocol, or checking transport details.
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
        url: https://modelcontextprotocol.io/mcp
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
          tool: search_model_context_protocol
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
