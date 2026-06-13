---
name: search-mcp-docs
description: Search the Model Context Protocol specification. Use when implementing MCP clients or servers, understanding the protocol, or checking transport details.
license: ISC
compatibility: Requires `onbraid` CLI and network access
allowed-tools: Bash
---

# Search MCP Docs

Query the Model Context Protocol specification via MCP.

## Usage

```bash
`onbraid mcp-client '{"mode":"call-tool","url":"https://modelcontextprotocol.io/mcp","tool":"search_model_context_protocol","args":{"query":"tools/call request format"}}'
```

Optional `version` parameter for targeting a specific protocol version:

```bash
`onbraid mcp-client '{"mode":"call-tool","url":"https://modelcontextprotocol.io/mcp","tool":"search_model_context_protocol","args":{"query":"Streamable HTTP","version":"2025-11-25"}}'
```

## When to use

- Implementing MCP clients or servers
- Checking JSON-RPC message formats
- Understanding Streamable HTTP transport details
- Looking up tool, resource, or prompt protocol methods

## See also

- `onbraid mcp-client --help` — discover all available MCP operations
- `onbraid mcp-client --schema input` — inspect the full input schema
