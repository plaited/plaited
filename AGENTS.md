# AGENTS.md

## Rules

# Bun APIs

**Prefer Bun over Node.js** when running in Bun environment.

**File system:** `Bun.file(path).exists()`, `.text()`, `.json()`, `.bytes()` — not `node:fs`. `Bun.write(path, data)` — not `writeFileSync`.
**Shell:** prefer `Bun.$\`cmd\`` with `.cwd()`, `.nothrow()`, `.quiet()` for repo scripts. Use `Bun.spawn()` only when lower-level process control is actually needed (IPC, manual stdin streaming, detached/background child management, explicit stdio descriptors).
**Path:** `Bun.resolveSync()` for modules, `import.meta.dir` for current dir. Keep `node:path` for join/resolve/dirname.
**Executables:** `Bun.which(cmd)` to check existence. `bunx` not `npx`.
**When Node.js OK:** readline, node:path, APIs without Bun equivalents.
**JSONL batch scripts:** for long-running scripts that emit `.jsonl`, stream rows to disk as they complete instead of buffering the full run in memory and writing once at the end. Keep a final summary print, but prefer append-style output for observability and crash recovery.
**Long-running summaries:** if a batch script runs for minutes or hours, write a rolling sidecar summary file (for example `output.jsonl.summary.json`) as rows complete. Do not keep summary state observable only in stdout.
**Batch memory discipline:** for high-row-count runners, keep only the minimum rolling counters and write queue in memory. Do not accumulate full result arrays unless the total result set is trivially small.
**Varlock-backed API calls:** when a repo script needs secrets injected by `varlock`, prefer direct Bun `fetch` or normal process env access inside the script. Avoid nested shell quoting pipelines for authenticated API calls because they are brittle and can masquerade as missing-key failures.
**You.com scripted integrations:** prefer the official `@youdotcom-oss/api` client before raw `fetch` for Bun scripts. Fall back to manual HTTP only for debugging or when the official client cannot express the needed endpoint behavior.
**API-bound evaluation matrices:** when a script is evaluating many independent rows against remote model APIs, prefer bounded concurrency instead of sequential execution. Default to a modest concurrency like `5` or `6` unless there is a clear provider-specific reason not to.
**Concurrency ramping:** for remote-model batch runs, start at a bounded concurrency, observe parse stability / retry behavior / provider throughput, then raise concurrency only after the smaller run is clean. Do not jump straight to the highest plausible parallelism.
**Throughput bottleneck assumption:** for OpenRouter or other remote-model lanes, assume network/provider latency is the main bottleneck before assuming local CPU or memory is. Optimize script architecture first, then raise concurrency.
**Fanout observability:** for multi-attempt slice fanout or autoresearch with more than one concurrent attempt, use explicit `git worktree`-backed runs or an equivalent durable attempt directory. Each attempt must write observable artifacts while running:
  - status/result JSON
  - changed-file or diff summary
  - targeted validation result
Do not rely on long-running opaque subagent state as the only record for large fanout work.


# Workflow

## Git as Context

**Read history before working** — `git log --oneline -20` at session start.
**File history** — `git log --oneline -- <path>` to understand why.
**Branch scope** — `git diff main...HEAD --stat` for current changes.
**History over stale prose** — code + git history wins. Update the doc.

## Git Commits

**Conventional commits** — `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`
**Multi-line messages** for detailed context. **Never --no-verify**.
**Wrap commit body lines at 100 chars or less** to satisfy commitlint.
**When a multi-line message is awkward in shell quoting, use a commit message file** rather than
forcing escaped newlines into `git commit -m`.

**Git lock recovery:** if `/.git/index.lock` is present, first assume an interrupted or overlapping
Git operation rather than corruption. Check that no Git process is still running, then remove the
stale lock with `rm -f .git/index.lock` before retrying. Avoid starting a new commit while hook
formatters or other Git operations are still in flight.


## Code Quality Gate

Before committing code, always choose validation based on area of effect.

Use Bun as the default test runner for repo validation commands.

Minimum gate:
1. `bun --bun tsc --noEmit`
2. targeted tests for the changed surface

Use broader validation when:
- runtime behavior changes
- tool behavior changes
- schemas or validators change
- shared infrastructure changes
- the area of effect is broad or uncertain

Use the minimum gate when:
- the change is tightly bounded and verified by file inspection or code search
- only a small, clearly isolated executable surface changed
- the change is path-only rename, link/reference cleanup, wording-only docs/skills text,
  or another edit that does not materially change executable behavior

If you choose targeted tests instead of the full suite, state the scope and why the narrower
gate is sufficient.

Broader validation is still area-aware. It does not mean “run unrelated tests.”
Examples:
- if only `scripts/` research infrastructure changed, run the relevant `scripts/tests/*`
  plus any shared `src/` tests that those changes affect
- if only `src/ui/` changed, run the relevant UI test surfaces
- if shared code changed and the impact is broad or unclear, expand test coverage until the
  affected surface is credibly covered

`docs:` and `chore:` commits may skip executable validation when they do not change behavior.

## Directory Boundaries

**`src/`** — Framework code that ships with the node. CLI tools (`src/tools/`), runtime modules, schemas, types.
**`scripts/`** — Calibration & eval infrastructure: graders, adapters, runners, MLX server launchers. Removed post-distillation.
**`skills/`** — Implementation patterns + operational tools. Skill assets (prompts, references) live under their skill directory.

**Never put graders, eval runners, or adapters in `src/tools/`.** Those are calibration infrastructure, not CLI commands.

## Python Stack

**Use `uv`** for Python environment and dependency management.

**Project boundary:** Python belongs in dedicated subprojects, not the Bun repo root.
- Good: `dev-research/native-model/training/`
- Avoid: root-level `pyproject.toml` for the whole repo

**Required files for Python subprojects:**
- `pyproject.toml`
- `.python-version`
- `uv.lock`
- local `.venv/` (ignored)

**Default Python tools:**
- **Lint/format:** `ruff`
- **Tests:** `pytest`

**Default Python workflow:**
1. `uv sync`
2. `uv run ruff check .`
3. `uv run pytest`

**Runtime smoke test first** — before wiring MLX/training/inference commands:
```bash
uv run python -c "import mlx.core as mx; print(mx.default_device())"
```

**Bun wrapper rule:** if a Python training/inference workflow is meant to be run from this repo, expose it through a Bun `scripts/*.ts` wrapper and a `package.json` command. Keep Python as the backend implementation, not the primary operator surface.

**Do not ad hoc `pip install` into the repo root.** Python here supports training/inference workflows, not the shipped framework runtime.

## GitHub CLI

**Always use `gh` for GitHub URLs** — `gh api`, `gh pr view`, `gh issue view`. Never WebFetch for GitHub content.


# Context Repository

**Source of Truth Hierarchy:**

| Source | Role |
|--------|------|
| `src/` code + types | What the system IS |
| `git log` | Why it changed |
| `AGENTS.md` | How to work here (rules) |
| `dev-research/*/program.md` | Active research programs and execution goals |
| `docs/*.md` | Design rationale (verify against code) |
| `skills/` | Implementation patterns + operational tools |

**When sources conflict:** Code + git history wins. Update the stale doc.

**Keep docs in sync:** When code changes affect docs, update in the same commit.


# Module Organization

**No index.ts** — rename to feature name.
**Explicit .ts extensions** — `import { x } from './file.ts'`
**Re-export at boundaries** — parent `feature.ts` re-exports from `feature/feature.ts`.
**No internal barrel duplicate** — keep the outer boundary file like `src/feature.ts`, but do not add an extra
`src/feature/feature.ts` barrel when direct exports from concrete files are clearer.
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
**Run:** choose tests by affected surface. Do not run unrelated areas just to satisfy a blanket rule.
Expand test coverage when the impact is broad, shared, or uncertain.


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
