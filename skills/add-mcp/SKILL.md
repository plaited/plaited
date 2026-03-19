---
name: add-mcp
description: Transport-agnostic MCP integration patterns. Explains session API, transport choices, and how to use the framework's shared MCP library surface.
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

For HTTP endpoints, use `add-remote-mcp` which scaffolds wrapper skills around the shared `plaited/mcp` library export.

## Session API

The session API maintains a single connection for multiple operations.
See [references/session-template.ts](references/session-template.ts).

`await using` automatically closes the connection when the block exits — no manual cleanup needed.

## One-shot pattern

For single operations, use `mcpConnect` directly.
See [references/one-shot-template.ts](references/one-shot-template.ts).

## Framework MCP Library

The framework ships a shared MCP library surface via `plaited/mcp`.

## References

- **`references/session-template.ts`** — Reusable session pattern with `await using`
- **`references/one-shot-template.ts`** — One-shot client pattern

## Dependencies

- **`@modelcontextprotocol/sdk`** — MCP protocol client. Provides `Transport` interface, `Client`, and transport implementations.
