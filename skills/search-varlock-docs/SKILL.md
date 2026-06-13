---
name: search-varlock-docs
description: Search the Varlock documentation for AI-safe environment configuration. Use when working with .env.schema files, secret providers, leak detection, or understanding how Varlock integrates with node provisioning.
license: ISC
compatibility: Requires `onbraid` CLI and network access
allowed-tools: Bash
---

# Search Varlock Docs

Query the Varlock documentation via MCP.

## Usage

```bash
`onbraid mcp-client '{"mode":"call-tool","url":"https://docs.mcp.varlock.dev/mcp","tool":"varlock docs","args":{"query":".env.schema format"}}'
```

## When to use

- Understanding `.env.schema` format and metadata annotations (`@sensitive`, `@required`, `@type`)
- Setting up secret provider plugins (1Password, Infisical, AWS, Azure, Google, Bitwarden)
- Configuring leak detection and prevention
- Integrating Varlock into node provisioning workflows
- Learning runtime resolution from multiple sources (local files, env-specific overrides, external secret managers)

## See also

- `onbraid mcp-client --help` — discover all available MCP operations
- `onbraid mcp-client --schema input` — inspect the full input schema
