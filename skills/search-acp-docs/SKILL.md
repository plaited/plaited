---
name: search-acp-docs
description: Search the Agent Client Protocol documentation. Use when implementing ACP clients or servers, understanding the protocol, or checking transport details.
license: ISC
compatibility: Requires bun and network access
allowed-tools: Bash
---

# Search ACP Docs

Query the Agent Client Protocol documentation via MCP.

## Usage

```bash
bun run skills/search-acp-docs/scripts/search.ts '{"query": "task lifecycle"}'
```

## Available scripts

- [**scripts/search.ts**](scripts/search.ts) — Search the Agent Client Protocol knowledge base. Takes JSON with a `query` field, prints matching documentation to stdout.

## When to use

- Implementing ACP clients or servers
- Understanding the ACP task lifecycle (send, stream, cancel, resubscribe)
- Checking Agent Card discovery and capabilities
- Looking up push notification configuration
- Understanding ACP JSON-RPC methods and error codes
