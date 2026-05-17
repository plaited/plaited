---
name: search-acp-docs
description: Search and read the Agent Client Protocol documentation. Use when building ACP agents or clients, implementing editor-agent JSON-RPC flows, checking session management, permissions, file access, or MCP server integration details.
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
        url: https://agentclientprotocol.com/mcp
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
          tool: search_agent_client_protocol
      - id: docs.query-filesystem
        type: cli
        lane: private
        phase: context
        audience: [analyst]
        actions: [list, search, read]
        sideEffects: network
        handler:
          type: cli
          command: scripts/query-docs.ts
        source:
          type: remote-mcp
          tool: query_docs_filesystem_agent_client_protocol
---

# Search ACP Docs

Query the Agent Client Protocol documentation via MCP.

## Usage

```bash
bun run skills/search-acp-docs/scripts/search.ts '{"query": "session prompt lifecycle"}'
bun run skills/search-acp-docs/scripts/query-docs.ts '{"command": "tree / -L 2"}'
```

## Available scripts

- [**scripts/search.ts**](scripts/search.ts) — Search the Agent Client Protocol documentation. Takes JSON with a `query` field and prints matching documentation to stdout.
- [**scripts/query-docs.ts**](scripts/query-docs.ts) — Run a read-only command against the remote documentation filesystem. Takes JSON with a `command` field and prints results to stdout.

## When to use

- Building ACP agents or editor clients
- Implementing JSON-RPC initialization, session setup, prompt turns, cancellation, or close flows
- Checking file access, permission request, terminal, or tool execution semantics
- Configuring MCP servers for ACP-compatible agents
- Reading exact documentation pages after search returns a path

## Workflow

Start with [**scripts/search.ts**](scripts/search.ts) for broad or conceptual questions. Use
[**scripts/query-docs.ts**](scripts/query-docs.ts) when you need exact keyword matching, docs
structure, OpenAPI inspection, or full page content.

The remote docs filesystem is rooted at `/`, is stateless between calls, and is read-only. Convert
filesystem paths to URL paths by removing the `.mdx` suffix when referencing pages.
