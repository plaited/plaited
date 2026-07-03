---
name: mdn-web-docs
description: >
  Search, read, and check browser compatibility for web platform
  documentation via the MDN MCP server. Covers all three tools: search,
  get-doc (full MDN pages as markdown), and get-compat (Browser
  Compatibility Data). Use when the task requires authoritative web
  technology documentation, browser support tables, API references,
  or CSS/HTML/JavaScript feature lookups.
compatibility: Requires plaited CLI (mcp-client mode) and network access.
---

# MDN Web Docs MCP Server

Connect to Mozilla's MDN Web Docs via the [MDN MCP server](https://developer.mozilla.org/en-US/blog/introducing-mdn-mcp-server/)
at `https://mcp.mdn.mozilla.net/`. The server is public — no authentication needed.

## Available Tools

Discover the canonical tool list at runtime:

```bash
plaited mcp-client '{"mode":"list-tools","url":"https://mcp.mdn.mozilla.net/"}'
```

Three tools are available:

| Tool | Description |
|------|-------------|
| `search` | Search MDN for documentation about web technologies. Takes a `query` string. Returns a list of results with paths, descriptions, and BCD feature keys. |
| `get-doc` | Retrieve a full MDN documentation page as markdown. Takes a `path` (e.g., `/en-US/docs/Web/API/Headers`). Includes compat-key for cross-referencing with `get-compat`. |
| `get-compat` | Retrieve Browser Compatibility Data (BCD) for a feature. Takes a `key` (e.g., `api.fetch`, `css.properties.container`). Returns structured JSON with per-browser support tables. |

## Usage

### Search

```bash
plaited mcp-client '{"mode":"call-tool","url":"https://mcp.mdn.mozilla.net/","tool":"search","args":{"query":"CSS container queries"}}'
```

### Get documentation

```bash
plaited mcp-client '{"mode":"call-tool","url":"https://mcp.mdn.mozilla.net/","tool":"get-doc","args":{"path":"/en-US/docs/Web/API/Headers"}}'
```

Paths can be relative (`/en-US/docs/Web/API/Headers`) or full URLs (`https://developer.mozilla.org/en-US/docs/Web/API/Headers`).

### Get browser compatibility data

```bash
plaited mcp-client '{"mode":"call-tool","url":"https://mcp.mdn.mozilla.net/","tool":"get-compat","args":{"key":"api.fetch"}}'
```

BCD keys follow the MDN BCD naming convention:
- JavaScript: `javascript.builtins.Array.map`
- CSS: `css.properties.container`, `css.properties.display`
- HTML: `html.elements.canvas`
- DOM APIs: `api.fetch`, `api.Headers`, `api.Request`

## Response format

- **`search`** returns a list of results — each has a title, path, and text snippet.
- **`get-doc`** returns the full page content as markdown, plus metadata like `compat-key` for cross-referencing with `get-compat`.
- **`get-compat`** returns detailed structured JSON with per-browser support info including:
  - `version_added` / `version_removed`
  - `release_date`
  - `notes` (implementation caveats)
  - `status` (`deprecated`, `experimental`, `standard_track`)
  - `tags` (web-features grouping)

## Auth

None. The MDN MCP server is a public endpoint.