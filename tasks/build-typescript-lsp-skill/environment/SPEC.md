# SPEC — `typescript-lsp` skill

This document is the complete contract for the skill you must author and
install. It has three parts: the **skill directory contract** (what a
well-formed skill looks like and where it gets installed), the **CLI
contract** (exact input/output JSON shapes for every mode), and the **grading
rubric** (what the verifier checks).

Everything here is self-contained — no network access is needed or possible.
Bun is preinstalled, and the **TypeScript 7 native preview** package
(`typescript@7.0.2`) is preinstalled at `/app/node_modules/typescript`. A
script located anywhere under `/app` (including
`/app/.agents/skills/typescript-lsp/scripts/`) imports it through normal
module resolution:

```ts
import { SyntaxKind } from 'typescript/unstable/ast'
import {
  isClassDeclaration,
  isEnumDeclaration,
  isFunctionDeclaration,
  isInterfaceDeclaration,
  isModuleDeclaration,
  isTypeAliasDeclaration,
  isVariableStatement,
} from 'typescript/unstable/ast/is'
import { API } from 'typescript/unstable/async'
```

---

## 1. Skill directory contract

A skill is a directory containing, at minimum, a `SKILL.md` file:

```
typescript-lsp/
├── SKILL.md                  # required: YAML frontmatter + Markdown body
└── scripts/
    └── typescript-lsp        # the CLI script (or typescript-lsp.ts)
```

### 1.1 SKILL.md

`SKILL.md` must contain YAML frontmatter between `---` delimiters, followed by
a Markdown body:

```markdown
---
name: typescript-lsp
description: <what the skill does and when to use it>
---

# TypeScript LSP

<body: instruct an agent how and when to invoke the script>
```

Frontmatter rules:

- `name` is **required**, must be `typescript-lsp` — exactly matching the
  skill directory's name. Only lowercase letters, digits, and hyphens; 1–64
  characters; no leading/trailing/consecutive hyphens.
- `description` is **required**, non-empty (1–1024 characters). It should
  describe both what the skill does and when to use it.
- Additional optional fields (e.g. `license`, `compatibility`,
  `allowed-tools`) are permitted.

Body rules:

- Non-empty Markdown that instructs an agent how to invoke the script
  (invocation form, modes, when to use which mode) and where the script lives
  relative to the skill directory (`scripts/typescript-lsp`).

### 1.2 CLI script

- Lives at `scripts/typescript-lsp` or `scripts/typescript-lsp.<ext>` where
  ext is one of `ts`, `mts`, `js`, `mjs`, `sh`.
- Must be **executable** (`chmod +x`). For a Bun/TypeScript script the
  shebang must be `#!/usr/bin/env bun`.
- May only use the Bun standard library, `node:*` builtins, and the
  preinstalled `typescript` package. No other npm packages (there is no
  network and no registry cache).

### 1.3 Install locations (AgentSkills discovery convention)

Install the skill so a compliant agent discovers it:

- **Project-level (primary):** `/app/.agents/skills/typescript-lsp/` — a
  `SKILL.md` must exist at `/app/.agents/skills/typescript-lsp/SKILL.md`.
- **User-level (optional):** `~/.agents/skills/typescript-lsp/`.

If both exist, project-level wins (project overrides user on collision). The
verifier resolves the project-level location first and falls back to
user-level only when project-level is missing.

---

## 2. CLI contract

### 2.1 Invocation

- Input: a single JSON string as the **first positional argument**, or JSON on
  **stdin** when no positional argument is given.
- Output: exactly one JSON object on stdout (pretty-printed or compact — both
  are accepted).
- Exit codes: `0` when the CLI ran (even if individual requests inside
  `execute` failed — those are reported inline, see 2.4); **non-zero** for
  invalid input (unparseable JSON, unknown `mode`, missing required fields
  such as `file`, or an empty `requests` array).

### 2.2 Mode: `discover`

Input:

```json
{ "mode": "discover", "rootDir": "." }
```

`rootDir` optional (workspace root for `file://` URI resolution).

Output — the capabilities list is **fixed**: exactly these four entries
(order not graded, but no extras and none missing):

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

### 2.3 Mode: `execute`

Input:

```json
{
  "mode": "execute",
  "file": "/opt/fixtures/sample.ts",
  "rootDir": "/opt/fixtures",
  "requests": [
    {
      "method": "textDocument/documentSymbol",
      "params": { "textDocument": { "uri": "file:///opt/fixtures/sample.ts" } }
    }
  ]
}
```

- `file` **required**: path to the TypeScript/JavaScript file to analyze.
- `rootDir` optional (default `"."`): workspace root for `file://` URI
  resolution.
- `requests` **required**, at least one entry. Each entry has `method`
  (string) and optional `params` (method-specific object). Requests run in
  order in a single session; the file is opened automatically.

Only these four methods are supported. Any other method name produces an
inline error (see below), never a process failure.

### 2.4 Execute output

```json
{
  "mode": "execute",
  "file": "sample.ts",
  "results": [
    { "method": "textDocument/documentSymbol", "result": [ "...symbols..." ] },
    { "method": "textDocument/hover", "result": { "...hover..." } },
    { "method": "textDocument/references", "error": "Unsupported method: textDocument/references" }
  ]
}
```

- `file` is the analyzed file path relative to `rootDir` (POSIX separators).
- `results` has exactly one entry per request, **in request order**, each with
  `method` plus either `result` (success) or `error` (failure). A failed
  request never prevents other requests from running, and per-request failure
  keeps the exit code `0`.

Method-specific `result` shapes:

**`textDocument/documentSymbol`** — top-level symbols of the file, in source
order. `kind` is one of `Variable`, `Function`, `Class`, `Interface`,
`TypeAlias`, `Enum`, `Module`. `range` is a flat `[startOffset, endOffset]`
pair of character offsets into the file (not line/position objects).

```json
[
  { "name": "FIXED_PIVOT", "kind": "Variable", "range": [412, 440] },
  { "name": "RenderMode", "kind": "TypeAlias", "range": [442, 489] }
]
```

Symbol extraction rules (matching a standard top-level walk of
`sourceFile.statements`):

- variable statements (`const`/`let`): take the **first** declaration's name,
  kind `Variable`
- `function` declarations: kind `Function`
- `class` declarations: kind `Class`
- `interface` declarations: kind `Interface`
- `type` aliases: kind `TypeAlias`
- `enum` declarations: kind `Enum`
- `namespace`/`module` declarations: kind `Module`

**`textDocument/hover`** — a **flattened** object (not the LSP-standard
`{ contents, range }`):

```json
{
  "name": "formatValue",
  "kind": 2,
  "type": "(value: unknown, options: RenderOptions) => string",
  "documentation": "string | undefined",
  "tags": [{ "name": "param", "text": "..." }]
}
```

- Requires `params.textDocument.uri` and `params.position`
  (`{ line, character }`, **0-indexed**).
- When no symbol exists at the position, `result` is `null`/absent rather
  than an error.

**`textDocument/definition`** — standard LSP array:

```json
[
  {
    "uri": "file:///opt/fixtures/sample.ts",
    "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 5 } }
  }
]
```

**`textDocument/completion`** — `{ "isIncomplete": false, "entries": [...] }`.

Methods that require `textDocument.uri` but don't receive one must return an
inline `error` for that request (message must mention the missing URI), not
crash.

### 2.5 Error-handling edge cases

- Invalid input (unparseable JSON, unknown `mode`, missing `file`, empty or
  missing `requests`) → non-zero exit.
- `file` that does not exist → non-zero exit with an error mentioning the
  path.
- Per-request failures (unsupported method, missing params, bad position) →
  inline `error` on that result, exit code stays `0`.

---

## 3. Fixture for self-testing

A sample TypeScript file is baked in at `/opt/fixtures/sample.ts` with these
top-level symbols, in source order: `FIXED_PIVOT` (Variable), `RenderMode`
(TypeAlias), `RenderOptions` (Interface), `Renderer` (Class), `formatValue`
(Function), `OutputFlavor` (Enum), `internals` (Module). Typical use:

```bash
bun /path/to/your/script.ts '{"mode":"execute","rootDir":"/opt/fixtures","file":"/opt/fixtures/sample.ts","requests":[{"method":"textDocument/documentSymbol","params":{"textDocument":{"uri":"file:///opt/fixtures/sample.ts"}}}]}'
```

The grader recomputes expected symbols, kinds, offsets, and a hover position
from this same file using the preinstalled TypeScript API, then compares your
CLI's output against them.

---

## 4. Grading rubric

The verifier produces `/logs/verifier/reward.json`:

```json
{
  "reward": 0.6667,
  "skill_valid": 1,
  "cli_accuracy": 0.6667,
  "checks_passed": 6,
  "checks_total": 9,
  "installed_project_level": 1,
  "installed_user_level": 0
}
```

**Layer 1 — discovery + skill validity (gates the reward).** If any of these
fail, `skill_valid` is `0` and the final `reward` is `0`:

1. A skill directory named `typescript-lsp` is installed at
   `/app/.agents/skills/typescript-lsp/` (or `~/.agents/skills/typescript-lsp/`).
2. `SKILL.md` exists; frontmatter parses; `name` is `typescript-lsp` (matches
   the directory, lowercase/digits/hyphens, ≤64 chars); `description` is
   non-empty; the body is non-empty.
3. A CLI script exists under `scripts/` and is executable.

**Layer 2 — CLI behavioral correctness (graded fraction).** With
`skill_valid = 1`, the verifier runs your CLI against the fixture file and
recomputes truth with the TypeScript API (9 checks):

1. `discover` returns `mode: "discover"` with a capabilities array.
2. `discover` capabilities are exactly the four documented method/capability
   pairs.
3. `execute` envelope: `mode` is `execute`, `file` points at the fixture, and
   `results` align one-to-one with the requests in order.
4. `documentSymbol` names match the recomputed top-level symbols in source
   order.
5. `documentSymbol` kinds match the recomputed kinds.
6. `documentSymbol` ranges match the recomputed `[start, end]` offsets.
7. `hover` at the recomputed position of `formatValue` returns that name and
   a non-empty `type` string.
8. An unsupported method (e.g. `textDocument/references`) produces an inline
   `error` mentioning `Unsupported method` while other requests still
   succeed.
9. Invalid input (unparseable JSON) exits non-zero.

`cli_accuracy = checks_passed / checks_total`; the final `reward` is
`skill_valid * cli_accuracy`.
