# AGENTS.md

## Rules

# Bun APIs

**Prefer Bun over Node.js** when running in Bun environment.

**File system:** `Bun.file(path).exists()`, `.text()`, `.json()`, `.bytes()` — not `node:fs`. `Bun.write(path, data)` — not `writeFileSync`.
**Shell:** `Bun.$\`cmd\`` with `.cwd()`, `.nothrow()`, `.quiet()` — not `child_process`.
**Path:** `Bun.resolveSync()` for modules, `import.meta.dir` for current dir. Keep `node:path` for join/resolve/dirname.
**Executables:** `Bun.which(cmd)` to check existence. `bunx` not `npx`.
**When Node.js OK:** readline, node:path, APIs without Bun equivalents.


# Workflow

## Git as Context

**Read history before working** — `git log --oneline -20` at session start.
**File history** — `git log --oneline -- <path>` to understand why.
**Branch scope** — `git diff main...HEAD --stat` for current changes.
**History over stale prose** — code + git history wins. Update the doc.

## Git Commits

**Conventional commits** — `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`
**Multi-line messages** for detailed context. **Never --no-verify**.

## Code Quality Gate

Before committing code, both must pass:
1. `bun --bun tsc --noEmit`
2. `bun test src/ skills/ scripts/`

*Exception:* `docs:` and `chore:` commits skip this gate.

## Directory Boundaries

**`src/`** — Framework code that ships with the node. CLI tools (`src/tools/`), runtime modules, schemas, types.
**`scripts/`** — Calibration & eval infrastructure: graders, adapters, runners, MLX server launchers. Removed post-distillation.
**`skills/`** — Implementation patterns + operational tools. Skill assets (prompts, references) live under their skill directory.

**Never put graders, eval runners, or adapters in `src/tools/`.** Those are calibration infrastructure, not CLI commands.

## GitHub CLI

**Always use `gh` for GitHub URLs** — `gh api`, `gh pr view`, `gh issue view`. Never WebFetch for GitHub content.


# Context Repository

**Source of Truth Hierarchy:**

| Source | Role |
|--------|------|
| `src/` code + types | What the system IS |
| `git log` | Why it changed |
| `AGENTS.md` | How to work here (rules) |
| `CLAUDE.md` | Active decisions, what's next |
| `docs/*.md` | Design rationale (verify against code) |
| `skills/` | Implementation patterns + operational tools |

**When sources conflict:** Code + git history wins. Update the stale doc.

**Keep docs in sync:** When code changes affect docs, update in the same commit.


# Module Organization

**No index.ts** — rename to feature name.
**Explicit .ts extensions** — `import { x } from './file.ts'`
**Re-export at boundaries** — parent `feature.ts` re-exports from `feature/feature.ts`.
**Helpers first** — define helper consts/functions BEFORE their first reference.
**Direct imports** — import from specific files, not through re-exports within a module.

**File naming:**
- Shared files use module prefix: `feature.types.ts`, `feature.schemas.ts`, `feature.utils.ts`, `feature.constants.ts`
- Feature files use dash-case: `create-agent-loop.ts`, `control-island.ts`, `key-mirror.ts`
- Name the file after its primary export: `createA2AHandler` → `create-a2a-handler.ts`
- Main entry uses module name: `behavioral.ts`, `server.ts`, `controller.ts`
- **Never prefix feature files with the directory name** — the directory already provides context

**File organization:**
- `feature.types.ts` — types only
- `feature.schemas.ts` — Zod schemas + `z.infer<>` types
- `feature.constants.ts` — constants
- `feature.ts` — main implementation


# Testing

**Use `test` not `it`**. **Organize with `describe`**.
**No conditional assertions** — assert condition first, then value.
**Test both branches** — try/catch, conditionals, fallbacks need both paths.
**Use real dependencies** — prefer installed packages over mocks.
**Coverage:** happy path, edge cases, error paths, real integrations.
**Run:** `bun test src/ skills/ scripts/` before commit.


# Accuracy

**95% confidence threshold** — report uncertainty rather than guess.
**Verification first** — read files before stating implementation details.
**When uncertain:** state the discrepancy, explain why, present to user. Never invent solutions.
**TypeScript verification** — use the `lsp` tool for type-aware analysis (hover, references, definitions, symbols, exports, find).


# Core Conventions

**Type over interface** — `type User = {` not `interface User {`
**No any** — use `unknown` with type guards.
**PascalCase types** — schemas get `Schema` suffix.
**Arrow functions** — `const fn = () =>` over `function fn()`.
**Object params >2 args** — `fn({ a, b, c }: { ... })`.
**Private fields** — `#field` (ES2022) not `private field`.
**JSON imports** — `import x from 'file.json' with { type: 'json' }`.
**@ts-ignore needs description** — `// @ts-ignore - reason here`.
**Mermaid diagrams only** — no ASCII box-drawing.
**AgentSkills validation** — `bun plaited validate-skill <path>`.

# Skill Pointers

**TSDoc** — use `code-documentation` skill for conventions when writing/editing TSDoc.
**BP patterns** — use `behavioral-core` skill when implementing behavioral programs.
**UI development** — use `generative-ui` skill for controller protocol and custom elements.
**Testing UI** — use `ui-testing` skill for three-layer test strategy.
**Agent pipeline** — use `agent-loop` skill when implementing createAgentLoop, wiring handlers, or designing event flow.
