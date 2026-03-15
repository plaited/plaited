---
name: add-mcp
description: Transport-agnostic MCP client with session API. Routes by transport type — HTTP (add-remote-mcp), stdio (future), WebSocket (future). Provides connection reuse, timeouts, and Symbol.asyncDispose cleanup.
license: ISC
compatibility: Requires bun and @modelcontextprotocol/sdk
allowed-tools: Bash Read Write
---

# Add MCP

Transport-agnostic MCP client core. Use this skill when integrating any MCP server regardless of transport.

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

For HTTP endpoints, use `add-remote-mcp` which provides URL-based convenience wrappers.

## Session API

The session API maintains a single connection for multiple operations:

```typescript
import { createMcpSession } from '../../add-mcp/scripts/mcp-client.ts'
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
import { mcpConnect } from '../../add-mcp/scripts/mcp-client.ts'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const transport = new StreamableHTTPClientTransport(new URL('https://example.com/mcp'))
const client = await mcpConnect(transport)
try {
  const { tools } = await client.listTools()
} finally {
  await client.close()
}
```

## Scripts

- **`scripts/mcp-client.ts`** — Core library: `mcpConnect`, `createMcpSession`, result types
- **`scripts/mcp-client.schemas.ts`** — Zod schemas for MCP response validation

## Dependencies

- **`@modelcontextprotocol/sdk`** — MCP protocol client. Provides `Transport` interface, `Client`, and transport implementations.
