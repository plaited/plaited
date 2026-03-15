---
name: search-varlock-docs
description: Search the Varlock documentation for AI-safe environment configuration. Use when working with .env.schema files, secret providers, leak detection, or understanding how Varlock integrates with node provisioning.
license: ISC
compatibility: Requires bun and network access
allowed-tools: Bash
---

# Search Varlock Docs

Query the Varlock documentation via MCP.

## Usage

```bash
bun run skills/search-varlock-docs/scripts/search.ts '{"query": ".env.schema format"}'
```

## Available scripts

- [**scripts/search.ts**](scripts/search.ts) — Search the Varlock documentation. Takes JSON with a `query` field, prints matching documentation to stdout.

## When to use

- Understanding `.env.schema` format and metadata annotations (`@sensitive`, `@required`, `@type`)
- Setting up secret provider plugins (1Password, Infisical, AWS, Azure, Google, Bitwarden)
- Configuring leak detection and prevention
- Integrating Varlock into node provisioning workflows
- Learning runtime resolution from multiple sources (local files, env-specific overrides, external secret managers)
