---
name: search-cline-docs
description: Search and read Cline documentation through the Cline remote MCP server. Use when working with Cline, Cline Kanban, Cline MCP setup, OpenRouter provider configuration in Cline, or Cline automation workflows.
license: ISC
compatibility: Requires bun and network access
allowed-tools: Bash
---

# Search Cline Docs

Use this repo-local skill to query the Cline documentation remote MCP server at
`https://docs.cline.bot/mcp`.

This skill is private to this repository under `.agents/skills`; do not move it
to public `skills/` unless Plaited starts shipping Cline integration guidance as
framework documentation.

## When To Use

- Researching Cline, Cline Kanban, Cline MCP, provider setup, or OpenRouter
  configuration in Cline.
- Checking current Cline docs before changing Plaited's agent-development
  workflow.
- Looking up exact Cline documentation pages for handoff prompts or workflow
  guidance.

## Workflow

1. Start with semantic search:

   ```bash
   bun .agents/skills/search-cline-docs/scripts/search.ts '{"query":"Cline Kanban worktrees"}'
   ```

2. If search returns a page path and you need exact content, read it from the
   virtual docs filesystem. Append `.mdx` to page paths returned by search when
   needed:

   ```bash
   bun .agents/skills/search-cline-docs/scripts/query-docs.ts '{"command":"head -120 /kanban/overview.mdx"}'
   ```

3. Prefer targeted `rg -C` or `head -N` over broad `cat` on large pages:

   ```bash
   bun .agents/skills/search-cline-docs/scripts/query-docs.ts '{"command":"rg -C 3 \"OpenRouter\" /"}'
   ```

## MCP Server

- URL: `https://docs.cline.bot/mcp`
- Tools:
  - `search_cline` for semantic search over the Cline knowledge base.
  - `query_docs_filesystem_cline` for read-only queries against a virtual Cline
    docs filesystem.
- Resources discovered:
  - `mintlify://skills/cline`
- Prompts discovered: none.

## Notes

- The docs filesystem tool is remote and read-only; it is not a shell on this
  machine.
- Each docs filesystem call is stateless and starts from `/`.
- Convert `.mdx` paths back to URL paths in summaries by removing `.mdx`.
- Do not include Cline/OpenRouter API keys in prompts, commands, or committed
  files.
