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
|------|------------|
| Type signature + TSDoc at position | `textDocument/hover` |
| Go to definition of a symbol | `textDocument/definition` |
| Go to type definition | `textDocument/typeDefinition` |
| Go to implementation | `textDocument/implementation` |
| List all symbols in a file | `textDocument/documentSymbol` |
| Autocomplete at position | `textDocument/completion` |
| Signature help at position | `textDocument/signatureHelp` |
| Rename symbol across workspace | `textDocument/rename` |
| List code actions at position | `textDocument/codeAction` |
| Format a document | `textDocument/formatting` |
| Semantic tokens for highlighting | `textDocument/semanticTokens` |

Methods available depend on the installed `typescript-language-server` —
run `discover` mode first to confirm what this server exposes. Some methods in
the table above may be unsupported by the installed build (e.g.
`textDocument/references` and `workspace/symbol` are frequently unsupported);
unsupported methods return `"error": "Unsupported method: <method>"` rather
than a result.

For non-LSP tasks: use **Glob** for file finding, **Grep** for text search.

## Usage

Single command with JSON input. Two modes via `mode` discriminant:

```bash
`plaited typescript-lsp '<json>'
echo '<json>' | plaited typescript-lsp
`plaited typescript-lsp --schema input    # JSON Schema for input
`plaited typescript-lsp --schema output   # JSON Schema for output
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

**Response shape:** Output shapes are method-specific and may differ from the
LSP standard (e.g. `hover` returns a flattened `{ name, kind, type,
documentation, tags }` rather than `{ contents, range }`). Inspect the actual
fields per method rather than assuming a single shape. URIs in results are
absolute `file://` URIs; resolve them to repo-relative paths yourself if
needed.

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
  "file": "src/utils/key-mirror.ts",
  "results": [
    {
      "method": "textDocument/hover",
      "result": {
        "name": "keyMirror",
        "kind": 2,
        "type": {},
        "documentation": "Creates immutable object with self-referential key-value pairs.\nType-safe string constants for TypeScript.",
        "tags": [
          { "name": "template", "text": "Keys - String literal tuple" },
          { "name": "param", "text": "inputs - Strings to use as keys and values" },
          { "name": "returns", "text": "Frozen object where each key equals its value" }
        ]
      }
    },
    {
      "method": "textDocument/references",
      "error": "Unsupported method: textDocument/references"
    }
  ]
}
```

Each result corresponds to the request at the same index. Failed requests
(including unsupported methods) include an `error` field instead of `result`.
Other requests still run.

**Method-specific output shapes vary.** `hover` returns `{ name, kind, type,
documentation, tags }` (not the LSP-standard `{ contents, range }` shape — this
is a flattened/custom representation). `definition` returns the standard LSP
array of `{ uri, range: { start, end } }` objects. `documentSymbol` returns
entries with a flat `range: [start, end]` offset pair rather than the LSP
object shape. When parsing results, inspect the actual fields rather than
assuming a single shape across methods.

### Discover output

```json
{
  "mode": "discover",
  "capabilities": [
    { "method": "textDocument/documentSymbol", "capability": "documentSymbolProvider" },
    { "method": "textDocument/hover", "capability": "hoverProvider" },
    { "method": "textDocument/completion", "capability": "completionProvider" },
    { "method": "textDocument/definition", "capability": "definitionProvider" }
  ]
}
```

The capabilities array reflects the actual server response — it is not a
hardcoded list, and the methods present vary by installed build. A method
listed in the table above but absent from `discover` output is unsupported by
this server and will return `"error": "Unsupported method: <method>"` if
requested. Do not assume a method is available; confirm with `discover`.

## Common Workflows

### Get type info at position

```bash
`plaited typescript-lsp '{"mode":"execute","file":"src/utils/parser.ts","requests":[{"method":"textDocument/hover","params":{"textDocument":{"uri":"file:///home/user/project/src/utils/parser.ts"},"position":{"line":42,"character":10}}}]}'
```

### Find all references before refactoring

`textDocument/references` is frequently unsupported by `typescript-language-server`
builds (run `discover` to confirm). When it is unavailable, use `ripgrep`
(`rg --type ts '<symbol>'`) for reference-finding; the LSP `definition` method
(see below) remains available for single-definition jumps.

### Batch: hover + definition + symbols in one session

```bash
`plaited typescript-lsp '{"mode":"execute","file":"src/utils/parser.ts","requests":[
  {"method":"textDocument/hover","params":{"textDocument":{"uri":"file:///home/user/project/src/utils/parser.ts"},"position":{"line":10,"character":13}}},
  {"method":"textDocument/definition","params":{"textDocument":{"uri":"file:///home/user/project/src/utils/parser.ts"},"position":{"line":10,"character":13}}},
  {"method":"textDocument/documentSymbol","params":{"textDocument":{"uri":"file:///home/user/project/src/utils/parser.ts"}}}
]}'
```

### Go to definition

```bash
`plaited typescript-lsp '{"mode":"execute","file":"src/utils/parser.ts","requests":[{"method":"textDocument/definition","params":{"textDocument":{"uri":"file:///home/user/project/src/utils/parser.ts"},"position":{"line":15,"character":8}}}]}'
```

### Search workspace for a symbol by name

`workspace/symbol` is frequently unsupported by `typescript-language-server`
builds (run `discover` to confirm). When unavailable, use `ripgrep`
(`rg --type ts '<symbol>'`) for symbol-name search across the workspace.

### List all symbols in a file

```bash
`plaited typescript-lsp '{"mode":"execute","file":"src/utils/parser.ts","requests":[{"method":"textDocument/documentSymbol","params":{"textDocument":{"uri":"file:///home/user/project/src/utils/parser.ts"}}}]}'
```

### Discover server capabilities

```bash
`plaited typescript-lsp '{"mode":"discover"}'
```

Use this first if you are unsure which methods the installed `typescript-language-server` supports.

## Notes

- All positions are 0-indexed (line 0 = first line, character 0 = first column).
- The `didOpen`/`didClose` lifecycle is managed automatically. You do not send these notifications.
- The `initialize` handshake is managed automatically. You do not send this request.
- Method-specific output shapes vary (see "Execute output" above); inspect the
  actual fields rather than assuming a single shape across methods.
- For a complete reference of LSP method names and their parameter shapes, consult the [LSP Specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/).
- Use `plaited typescript-lsp --schema input` to see the exact JSON Schema of accepted input.

## Exit Codes

- `0` — the tool ran (requests may still have failed individually; check each
  result for an `error` field rather than relying on the exit code to detect
  per-request failures).
- `2` — bad input or tool error.

Per-request failures (unsupported methods, out-of-range positions, etc.) are
reported inline as `"error": "<message>"` on the corresponding result and do
**not** change the process exit code. Inspect `results[].error` to detect
partial failures.

## Related Skills

- **typescript-lsp** (this skill) — use `discover` mode first to confirm available methods
