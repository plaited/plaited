---
name: typescript-lsp
description: LSP-style queries over TypeScript 7 native API — documentSymbol, hover, completion, definition. Two modes (execute and discover) for semantic code analysis without a language-server process. Use when you need type info, symbol lists, definitions, or autocomplete for TypeScript/JavaScript code.
license: ISC
compatibility: Requires bun
allowed-tools: Bash
---

# TypeScript LSP Skill

## Purpose

LSP-style queries over TypeScript's native API (TS7 `typescript/unstable/async`).
The CLI uses TypeScript's built-in checker directly — no `typescript-language-server`
process, no `tsserver.js`, no JSON-RPC lifecycle. You supply a method and params,
get the result.

Use this when you need semantic understanding of TypeScript/JavaScript code:
type info, symbol lists, definitions, or completions.

## When to Use

| Task | Method |
|------|--------|
| Type signature + TSDoc at position | `textDocument/hover` |
| Go to definition of a symbol | `textDocument/definition` |
| List all symbols in a file | `textDocument/documentSymbol` |
| Autocomplete at position | `textDocument/completion` |

These are the only four methods supported. Unsupported methods return
`"error": "Unsupported method: <method>"`.

For non-LSP tasks: use **Glob** for file finding, **Grep** for text search,
and `git log` for history.

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

Open a file and send LSP method requests in a single session. The CLI handles
file opening and parsing — you supply the method and params.

```json
{
  "mode": "execute",
  "file": "src/app.ts",
  "rootDir": ".",
  "requests": [
    { "method": "textDocument/hover", "params": { "textDocument": { "uri": "file:///abs/path/src/app.ts" }, "position": { "line": 5, "character": 10 } } },
    { "method": "textDocument/definition", "params": { "textDocument": { "uri": "file:///abs/path/src/app.ts" }, "position": { "line": 20, "character": 3 } } }
  ]
}
```

**Fields:**
- `mode` — must be `"execute"`
- `file` — path to TypeScript/JavaScript file (required)
- `rootDir` — workspace root for `file://` URI resolution (defaults to `.`)
- `requests` — array of request objects, each with:
  - `method` — one of the four supported methods
  - `params` — method-specific params object (see LSP spec for shape)

**URI construction:** The `params` for methods like `textDocument/hover` require
a `textDocument.uri` field. Construct it as `file://<absolute-path-to-file>`.

**Response shape:** Output shapes are method-specific. `hover` returns a
flattened `{ name, kind, type, documentation, tags }` rather than the LSP
standard `{ contents, range }`. `documentSymbol` returns entries with a flat
`range: [start, end]` offset pair. `definition` returns the standard LSP array
of `{ uri, range: { start, end } }`. Inspect actual fields per method rather
than assuming a single shape.

### Discover Mode

Return a list of supported methods. No file required.

```json
{
  "mode": "discover",
  "rootDir": "."
}
```

**Fields:**
- `mode` — must be `"discover"`
- `rootDir` — workspace root (defaults to `.`)

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
        "type": "(inputs: T) => { [K in T[number]]: K }",
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
documentation, tags }` (not the LSP-standard `{ contents, range }`).
`definition` returns the standard LSP array of `{ uri, range: { start, end } }`.
`documentSymbol` returns entries with flat `range: [start, end]` offset pairs.

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

The capabilities list is fixed — these four methods are always supported.
A method not listed here will return `"error": "Unsupported method: <method>"`.

## Common Workflows

### Get type info at position

```bash
plaited typescript-lsp '{"mode":"execute","file":"src/utils/parser.ts","requests":[{"method":"textDocument/hover","params":{"textDocument":{"uri":"file:///home/user/project/src/utils/parser.ts"},"position":{"line":42,"character":10}}}]}'
```

### List all symbols in a file

```bash
plaited typescript-lsp '{"mode":"execute","file":"src/utils/parser.ts","requests":[{"method":"textDocument/documentSymbol","params":{"textDocument":{"uri":"file:///home/user/project/src/utils/parser.ts"}}}]}'
```

### Go to definition

```bash
plaited typescript-lsp '{"mode":"execute","file":"src/utils/parser.ts","requests":[{"method":"textDocument/definition","params":{"textDocument":{"uri":"file:///home/user/project/src/utils/parser.ts"},"position":{"line":15,"character":8}}}]}'
```

### Batch: hover + definition + symbols in one session

```bash
plaited typescript-lsp '{"mode":"execute","file":"src/utils/parser.ts","requests":[
  {"method":"textDocument/hover","params":{"textDocument":{"uri":"file:///home/user/project/src/utils/parser.ts"},"position":{"line":10,"character":13}}},
  {"method":"textDocument/definition","params":{"textDocument":{"uri":"file:///home/user/project/src/utils/parser.ts"},"position":{"line":10,"character":13}}},
  {"method":"textDocument/documentSymbol","params":{"textDocument":{"uri":"file:///home/user/project/src/utils/parser.ts"}}}
]}'
```

### Discover server capabilities

```bash
plaited typescript-lsp '{"mode":"discover"}'
```

## Notes

- All positions are 0-indexed (line 0 = first line, character 0 = first column).
- The file is opened and parsed automatically. You do not send `didOpen`
  notifications.
- Method-specific output shapes vary (see "Execute output" above); inspect the
  actual fields rather than assuming a single shape across methods.
- For a complete reference of LSP method names and their parameter shapes,
  consult the [LSP Specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/).
- Use `plaited typescript-lsp --schema input` to see the exact JSON Schema of
  accepted input.

## Exit Codes

- `0` — the tool ran (requests may still have failed individually; check each
  result for an `error` field rather than relying on the exit code to detect
  per-request failures).
- `2` — bad input or tool error.

Per-request failures (unsupported methods, out-of-range positions, etc.) are
reported inline as `"error": "<message>"` on the corresponding result and do
**not** change the process exit code. Inspect `results[].error` to detect
partial failures.