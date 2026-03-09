# AGENTS.md — src/tools/

Rules for building CLI tools in this directory. Every tool serves two consumers: the agent loop (in-process dispatch) and the CLI (subprocess via `plaited <name>`).

## Two CLI Factories

| Factory | Use when | Schema type | Context |
|---------|----------|-------------|---------|
| `makeCli` | Tool is a `ToolHandler` dispatched by agent loop | `z.ZodObject<z.ZodRawShape>` | Extracts `cwd`/`timeout` → `ToolContext` |
| `parseCli` | Tool has custom execution (partial failures, custom exit codes) | `z.ZodSchema` | Tool manages its own context |

`makeCli` tools (crud): handler is `(args, ctx) => Promise<unknown>`, CLI is a thin wrapper.
`parseCli` tools (lsp, validate-skill): tool owns `--help`, exit codes, and execution flow.

*Verify:* Every tool uses one of these — never raw `process.argv` or `parseArgs`.
*Fix:* Import from `../cli.utils.ts`.

## File Structure

```
tool-name/
├── tool-name.ts          # Library exports + CLI handler
├── tool-name.schemas.ts  # Optional — split when schemas are shared or large
└── tests/
    └── tool-name.spec.ts
```

Schemas co-locate in main file (lsp, validate-skill) or split when shared across handlers (crud.schemas.ts used by 5 handlers).

*Verify:* No `index.ts` files. Explicit `.ts` extensions on all imports.

## Tool Anatomy

Every tool exports:

1. **Library functions** — pure, no `process.exit()`, no `console.log`. Testable in-process.
2. **Zod schemas** — input (`*ConfigSchema` / `*InputSchema`) + output. Every field has `.describe()`.
3. **CLI handler** — `async (args: string[]) => void`. Owns `process.exit`, stdout/stderr.

Agent-dispatched tools additionally export:

4. **`ToolHandler`** — `(args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>`
5. **Risk tags** — static `RISK_TAG` declarations (from `src/agent/agent.constants.ts`)
6. **`ToolDefinition`** — OpenAI function-calling format (for context assembly)

*Verify:* `grep 'process.exit' src/tools/` — only in CLI handlers, never in library functions.

## Agent Types

Import from `src/agent/`, never define locally:
- `ToolHandler`, `ToolContext` — from `agent.types.ts`
- `ToolDefinition` — from `agent.schemas.ts`
- `RISK_TAG` — from `agent.constants.ts`

*Verify:* `grep -r 'type ToolHandler' src/tools/` should return zero hits.

## Risk Tag Declarations

Every tool declares static risk tags. Gate bThreads inspect these for routing:
- `workspace`-only → execute directly (safe path, git-versioned)
- Empty/unknown → default-deny, routes to Simulate + Judge
- Any boundary/irreversible/audience tags → Simulate + Judge

```typescript
// crud.ts — all file ops are workspace-safe, bash is default-deny
export const BUILT_IN_RISK_TAGS: Record<string, string[]> = {
  read_file: [RISK_TAG.workspace],
  bash: [], // empty → Simulate + Judge
}

// lsp.ts — read-only analysis
export const lspRiskTags: string[] = [RISK_TAG.workspace]
```

*Verify:* Every exported `ToolHandler` has a corresponding risk tag declaration.

## Schema Conventions

- `z.object()` always — `makeCli` requires `z.ZodObject<z.ZodRawShape>` for `.extend()`
- `z.record(z.string(), z.string())` not `z.record(z.string())` — Zod v4 `toJSONSchema()` needs explicit key+value types
- `.describe()` on every field — these are the model's tool documentation
- Output field names match source spec verbatim (dash-case if spec says dash-case)

*Verify:* `--schema input` output has descriptions for all properties.

## CLI I/O Contract

| Feature | Behavior |
|---------|----------|
| Input | JSON as first positional arg or piped via stdin |
| Output | JSON on stdout. Errors on stderr |
| `--schema input` | Emits `z.toJSONSchema()` for input (includes `cwd`/`timeout` for `makeCli` tools) |
| `--schema output` | Emits output schema when provided |
| `--help` / `-h` | Usage text, exits 0 |
| Exit 0 | Success |
| Exit 1 | Domain error (validation failed, partial operation failure) |
| Exit 2 | Bad input or tool error |

## Testing Patterns

- **Subprocess tests** for `process.exit` paths (exit codes, `--schema`, `--help`):
  ```typescript
  const proc = Bun.spawn(['bun', '-e', `import { makeCli } from '...'; ...`], { stdout: 'pipe', stderr: 'pipe' })
  expect(await proc.exited).toBe(0)
  ```
- **In-process tests** for pure library logic (no subprocess overhead)
- `test()` not `it()`, `describe()` for grouping
- No conditional assertions — assert condition first, then value

*Verify:* `grep '\bit(' src/tools/**/tests/*.spec.ts` returns zero hits.

## Bun APIs

- `Bun.file(path).text()` / `Bun.file(path).exists()` — not `fs`
- `Bun.write(path, data)` — not `writeFileSync`
- `Bun.$\`cmd\`` with `.cwd()`, `.nothrow()`, `.quiet()` — not `child_process`
- `Bun.Glob` for file scanning
- `Bun.YAML.parse()` for YAML — no custom parsers
- `node:path` OK for join/resolve/dirname

*Verify:* `grep 'from .node:fs' src/tools/` returns zero hits.
