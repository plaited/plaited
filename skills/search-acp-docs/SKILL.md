---
name: search-acp-docs
description: Search and read the Agent Client Protocol documentation. Use when building ACP agents or clients, implementing editor-agent JSON-RPC flows, checking session management, permissions, file access, or MCP server integration details.
license: ISC
compatibility: Requires `onbraid` CLI and network access
allowed-tools: Bash
---

# Search ACP Docs

Query the Agent Client Protocol documentation via MCP.

## Usage

Search the documentation:

```bash
`onbraid mcp-client '{"mode":"call-tool","url":"https://agentclientprotocol.com/mcp","tool":"search_agent_client_protocol","args":{"query":"session prompt lifecycle"}}'
```

Query the remote documentation filesystem:

```bash
`onbraid mcp-client '{"mode":"call-tool","url":"https://agentclientprotocol.com/mcp","tool":"query_docs_filesystem_agent_client_protocol","args":{"command":"tree / -L 2"}}'
```

## When to use

- Building ACP agents or editor clients
- Implementing JSON-RPC initialization, session setup, prompt turns, cancellation, or close flows
- Checking file access, permission request, terminal, or tool execution semantics
- Configuring MCP servers for ACP-compatible agents
- Reading exact documentation pages after search returns a path

## Workflow

Start with `search_agent_client_protocol` for broad or conceptual questions. Use
`query_docs_filesystem_agent_client_protocol` when you need exact keyword matching, docs
structure, OpenAPI inspection, or full page content.

The remote docs filesystem is rooted at `/`, is stateless between calls, and is read-only. Convert
filesystem paths to URL paths by removing the `.mdx` suffix when referencing pages.

## See also

- `onbraid mcp-client --help` — discover all available MCP operations
- `onbraid mcp-client --schema input` — inspect the full input schema
