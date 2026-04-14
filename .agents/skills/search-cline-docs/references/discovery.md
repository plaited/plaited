# Cline MCP Discovery

Discovery URL: `https://docs.cline.bot/mcp`

Discovered with:

```bash
bun skills/add-remote-mcp/scripts/run.ts '{"url":"https://docs.cline.bot/mcp","operation":{"type":"discover"}}'
```

Notes:

- `session-summary` against this Mintlify endpoint currently returns MCP
  `Method not found` for the live session path.
- `discover` and `list-tools` work against the discovery URL.

Tools:

- `search_cline`
  - Input: `{ "query": string }`
  - Use for semantic search across the Cline knowledge base.
- `query_docs_filesystem_cline`
  - Input: `{ "command": string }`
  - Use for read-only shell-like queries against the virtual Cline docs
    filesystem.
  - Supported patterns include `tree`, `rg`, `head`, and `cat` against `.mdx`
    paths.

Resources:

- `mintlify://skills/cline`

Prompts: none.
