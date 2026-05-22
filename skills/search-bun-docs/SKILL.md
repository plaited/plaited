---
name: search-bun-docs
description: Search the Bun documentation. Use when answering questions about Bun APIs, runtime features, bundler, test runner, or package manager configuration.
license: ISC
compatibility: Requires `plaited` CLI and network access
allowed-tools: Bash
---

# Search Bun Docs

Query the Bun documentation via MCP.

## Usage

```bash
plaited mcp-client '{"mode":"call-tool","url":"https://bun.com/docs/mcp","tool":"search_bun","args":{"query":"Bun.file API"}}'
```

> [!CAUTION]
> **Common failure modes**
>
> 1. **Invalid JSON from special characters** — avoid unescaped backticks (`` ` ``),
>    unescaped double quotes, or raw newlines inside the JSON string argument. The
>    entire `'{}'` payload must be valid JSON. Use single quotes around the JSON blob
>    and escape any inner double quotes. Backticks inside the `query` value will break
>    JSON parsing — omit them or use `\``` ` ``\` if absolutely needed.
>
> 2. **Wrong URL** — the correct MCP endpoint is **`https://bun.com/docs/mcp`**,
>    not `bun.sh/api/mcp`. Using `bun.sh` returns a 404.

## When to use

- Looking up Bun runtime APIs (`Bun.file`, `Bun.serve`, `Bun.$`)
- Checking bundler or test runner configuration
- Finding package manager commands or compatibility details
- Verifying Bun-specific behavior vs Node.js

## See also

- `plaited mcp-client --help` — discover all available MCP operations
- `plaited mcp-client --schema input` — inspect the full input schema
