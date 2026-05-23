---
name: typescript-lsp
description: Type-aware TypeScript/JavaScript codebase analysis via raw JSON-RPC LSP messages. Provides a generic passthrough over typescript-language-server — supply the method and params, get the server response. Two modes execute and discover.
license: ISC
compatibility: Requires bun and typescript-language-server
allowed-tools: Bash
---

# TypeScript LSP Skill

## Purpose

Raw JSON-RPC passthrough over `typescript-language-server`. The CLI manages the server lifecycle (spawn, initialize, open document, send requests, shutdown) while the caller supplies the LSP method and params directly.

Use this when you need semantic understanding of TypeScript/JavaScript code: type info, references, definitions, symbols, or any LSP method supported by the server.

## When to Use

| Task | LSP Method |
|------|-----------|
| Type signature + TSDoc at position | `textDocument/hover` |
| Find all references to a symbol | `textDocument/references` |
| Go to definition of a symbol | `textDocument/definition` |
| Go to type definition | `textDocument/typeDefinition` |
| Go to implementation | `textDocument/implementation` |
| List all symbols in a file | `textDocument/documentSymbol` |
| Autocomplete at position | `textDocument/completion` |
| Signature help at position | `textDocument/signatureHelp` |
| Search workspace by symbol name | `workspace/symbol` |
| Rename symbol across workspace | `textDocument/rename` |
| List code actions at position | `textDocument/codeAction` |
| Format a document | `textDocument/formatting` |
| Semantic tokens for highlighting | `textDocument/semanticTokens` |

For non-LSP tasks: use **Glob** for file finding, **Grep** for text search.

## Usage

Single command with JSON input. Two modes via `mode` discriminant:

```bash
plaited typescript-lsp '<json>'
echo '<json>' | plaited typescript-lsp
plaited typescript-lsp --schema input    # JSON Schema for input
plaited typescript-lsp --schema output   # JSON Schema for output
```

## Modes

### Execute Mode

Open a file and send raw JSON-RPC requests in a single LSP session. The CLI handles `didOpen`/`didClose` lifecycle — you supply the method and params.

```json
{
  "mode": "execute",
  "file": "src/app.ts",
  "rootDir": ".",
  "requests": [
    { "method": "textDocument/hover", "params": { "textDocument": { "uri": "file:///abs/path/src/app.ts" }, "position": { "line": 5, "character": 10 } } },
    { "method": "textDocument/references", "params": { "textDocument": { "uri": "file:///abs/path/src/app.ts" }, "position": { "line": 20, "character": 3 } } }
  ]
}
```

**Fields:**
- `mode` — must be `"execute"`
- `file` — path to TypeScript/JavaScript file (required)
- `rootDir` — workspace root for `file://` URI resolution (defaults to `.`)
- `requests` — array of raw LSP request objects, each with:
  - `method` — LSP method name (e.g. `textDocument/hover`, `textDocument/references`)
  - `params` — method-specific params object (optional; see LSP spec for shape)

**URI construction:** The `params` for methods like `textDocument/hover` require a `textDocument.uri` field. Construct it as `file://<absolute-path-to-file>`. The `file` field is used for the `didOpen` notification; the `params` URIs are what you send.

**Response normalization:** Results that contain `uri` or `targetUri` fields are augmented with relative `path`/`targetPath` fields for agent consumption. The original URIs are preserved.

### Discover Mode

Probe the server's capabilities and return a list of supported LSP methods. No file required.

```json
{
  "mode": "discover",
  "rootDir": "."
}
```

**Fields:**
- `mode` — must be `"discover"`
- `rootDir` — workspace root for `file://` URI resolution (defaults to `.`)

## Output Format

### Execute output

```json
{
  "mode": "execute",
  "file": "src/app.ts",
  "results": [
    {
      "method": "textDocument/hover",
      "result": {
        "contents": { "kind": "markdown", "value": "```typescript\nconst x: number\n```" },
        "range": { "start": { "line": 5, "character": 6 }, "end": { "line": 5, "character": 7 } }
      }
    },
    {
      "method": "textDocument/references",
      "error": "Failed to find references: position out of range"
    }
  ]
}
```

Each result corresponds to the request at the same index. Failed requests include an `error` field instead of `result`. Other requests still run.

### Discover output

```json
{
  "mode": "discover",
  "capabilities": [
    { "method": "textDocument/hover", "capability": "hoverProvider" },
    { "method": "textDocument/references", "capability": "referencesProvider" },
    { "method": "textDocument/definition", "capability": "definitionProvider" },
    { "method": "textDocument/documentSymbol", "capability": "documentSymbolProvider" },
    { "method": "workspace/symbol", "capability": "workspaceSymbolProvider" }
  ]
}
```

The capabilities array reflects the actual server response — it is not a hardcoded list.

## Common Workflows

### Get type info at position

```bash
plaited typescript-lsp '{"mode":"execute","file":"src/utils/parser.ts","requests":[{"method":"textDocument/hover","params":{"textDocument":{"uri":"file:///home/user/project/src/utils/parser.ts"},"position":{"line":42,"character":10}}}]}'
```

### Find all references before refactoring

```bash
plaited typescript-lsp '{"mode":"execute","file":"src/utils/parser.ts","requests":[{"method":"textDocument/references","params":{"textDocument":{"uri":"file:///home/user/project/src/utils/parser.ts"},"position":{"line":42,"character":10}}}]}'
```

### Batch: hover + references + symbols in one session

```bash
plaited typescript-lsp '{"mode":"execute","file":"src/utils/parser.ts","requests":[
  {"method":"textDocument/hover","params":{"textDocument":{"uri":"file:///home/user/project/src/utils/parser.ts"},"position":{"line":10,"character":13}}},
  {"method":"textDocument/references","params":{"textDocument":{"uri":"file:///home/user/project/src/utils/parser.ts"},"position":{"line":10,"character":13}}},
  {"method":"textDocument/documentSymbol","params":{"textDocument":{"uri":"file:///home/user/project/src/utils/parser.ts"}}}
]}'
```

### Go to definition

```bash
plaited typescript-lsp '{"mode":"execute","file":"src/utils/parser.ts","requests":[{"method":"textDocument/definition","params":{"textDocument":{"uri":"file:///home/user/project/src/utils/parser.ts"},"position":{"line":15,"character":8}}}]}'
```

### Search workspace for a symbol by name

```bash
plaited typescript-lsp '{"mode":"execute","file":"src/app.ts","requests":[{"method":"workspace/symbol","params":{"query":"parseConfig"}}]}'
```

### List all symbols in a file

```bash
plaited typescript-lsp '{"mode":"execute","file":"src/utils/parser.ts","requests":[{"method":"textDocument/documentSymbol","params":{"textDocument":{"uri":"file:///home/user/project/src/utils/parser.ts"}}}]}'
```

### Discover server capabilities

```bash
plaited typescript-lsp '{"mode":"discover"}'
```

Use this first if you are unsure which methods the installed `typescript-language-server` supports.

## Notes

- All positions are 0-indexed (line 0 = first line, character 0 = first column).
- The `didOpen`/`didClose` lifecycle is managed automatically. You do not send these notifications.
- The `initialize` handshake is managed automatically. You do not send this request.
- Responses with `uri`/`targetUri` fields get augmented with relative `path`/`targetPath` fields for convenience. The original URIs remain unchanged.
- For a complete reference of LSP method names and their parameter shapes, consult the [LSP Specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/).
- Use `plaited typescript-lsp --schema input` to see the exact JSON Schema of accepted input.

## Exit Codes

- `0` — all requests succeeded
- `1` — one or more requests failed (partial results returned)
- `2` — bad input or tool error

## Related Skills

- **code-documentation** — TSDoc standards for documentation
- **typescript-lsp** (this skill) — use `discover` mode first to confirm available methods
