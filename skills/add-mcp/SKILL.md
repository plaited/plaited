---
name: add-mcp
description: Transport-agnostic MCP integration patterns. Explains session API, transport choices, and how to use the framework's shared MCP library surface.
license: ISC
compatibility: Requires bun and @modelcontextprotocol/sdk
allowed-tools: Bash Read Write
metadata:
  plaited:
    kind: skill
    origin:
      kind: first-party
    capabilities:
      - id: workflow.mcp-integration
        type: workflow
        lane: private
        phase: analysis
        audience: [coder]
        actions: [design, connect, guide]
        sideEffects: workspace-write
        source:
          type: first-party
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

For HTTP endpoints, use `add-remote-mcp`.
That skill starts from the remote URL you are given, which is often a discovery/manifest URL
such as `https://bun.com/docs/mcp`, and then determines whether you can stop at discovery or
need a separate live transport endpoint for session-style calls.

## Session API

The session API maintains a single connection for multiple operations.
See [references/session-template.ts](references/session-template.ts).

`await using` automatically closes the connection when the block exits — no manual cleanup needed.

For remote HTTP servers, only use a session when you have a live transport endpoint.
Manifest/discovery URLs are valid inputs for discovery and listing, but not necessarily for
connection reuse or direct tool invocation.

## One-shot pattern

For single operations, use `mcpConnect` directly.
See [references/one-shot-template.ts](references/one-shot-template.ts).

For remote HTTP discovery/list operations, prefer the higher-level helpers in `plaited/mcp`
such as `mcpDiscover`, `mcpListTools`, `mcpListPrompts`, and `mcpListResources`.

## Framework MCP Library

The framework ships a shared MCP library surface via `plaited/mcp`.

## References

- **`references/session-template.ts`** — Reusable session pattern with `await using`
- **`references/one-shot-template.ts`** — One-shot client pattern

## Dependencies

- **`@modelcontextprotocol/sdk`** — MCP protocol client. Provides `Transport` interface, `Client`, and transport implementations.
