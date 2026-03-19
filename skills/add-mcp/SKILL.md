---
name: add-mcp
description: Transport-agnostic MCP integration patterns. Explains session API, transport choices, and how to use the framework's shared MCP CLI and utilities.
license: ISC
compatibility: Requires bun and @modelcontextprotocol/sdk
allowed-tools: Bash Read Write
---

# Add MCP

Transport-agnostic MCP integration guidance. Use this skill when integrating any MCP server regardless of transport.

## When to use

- Connecting to MCP servers using any transport (HTTP, stdio, WebSocket)
- Building skills that need session reuse across multiple MCP operations
- Understanding the session vs one-shot pattern for MCP connections

## Transport routing

| Transport | Skill | Status |
|-----------|-------|--------|
| Streamable HTTP | `add-remote-mcp` | Available |
| stdio | Direct SDK usage | Future |
| WebSocket | Direct SDK usage | Future |

For HTTP endpoints, use `add-remote-mcp` which scaffolds wrapper skills around the shared `plaited mcp ...` CLI.

## Session API

The session API maintains a single connection for multiple operations:

```typescript
import { createMcpSession } from '../../../src/tools/mcp.utils.ts'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const transport = new StreamableHTTPClientTransport(new URL('https://example.com/mcp'))
await using session = await createMcpSession(transport, { timeoutMs: 30_000 })

const tools = await session.listTools()
const result = await session.callTool('search', { query: 'test' })
```

`await using` automatically closes the connection when the block exits — no manual cleanup needed.

## One-shot pattern

For single operations, use `mcpConnect` directly:

```typescript
import { mcpConnect } from '../../../src/tools/mcp.utils.ts'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const transport = new StreamableHTTPClientTransport(new URL('https://example.com/mcp'))
const client = await mcpConnect(transport)
try {
  const { tools } = await client.listTools()
} finally {
  await client.close()
}
```

## Framework MCP CLI

The framework ships a shared MCP CLI:

```bash
plaited mcp discover https://example.com/mcp
plaited mcp list-tools https://example.com/mcp
plaited mcp call https://example.com/mcp SearchExample '{"query":"test"}'
```

## References

- **`references/session-template.ts`** — Reusable session pattern with `await using`
- **`references/one-shot-template.ts`** — One-shot client pattern

## Dependencies

- **`@modelcontextprotocol/sdk`** — MCP protocol client. Provides `Transport` interface, `Client`, and transport implementations.
