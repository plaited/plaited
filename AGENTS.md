# AGENTS.md

## Rules

# Bun APIs

**Prefer Bun over Node.js** when running in Bun environment.

**File system:** `Bun.file(path).exists()`, `.text()`, `.json()`, `.bytes()` — not `node:fs`. `Bun.write(path, data)` — not `writeFileSync`.
**Shell:** prefer `Bun.$\`cmd\`` with `.cwd()`, `.nothrow()`, `.quiet()` for repo scripts. Use `Bun.spawn()` only when lower-level process control is actually needed (IPC, manual stdin streaming, detached/background child management, explicit stdio descriptors).
**Path:** `Bun.resolveSync()` for modules, `import.meta.dir` for current dir. Keep `node:path` for join/resolve/dirname.
**Executables:** `Bun.which(cmd)` to check existence. `bunx` not `npx`.
**When Node.js OK:** readline, node:path, APIs without Bun equivalents.
**Varlock-backed env:** when repo commands need secrets, use `.env.schema` and Varlock-injected
environment variables. Avoid brittle nested shell quoting for authenticated calls.
**Web research:** use the `youdotcom` skill for web search, research, and content extraction when
repo-local evidence is insufficient or current external context is needed.


# Workflow

## Git as Context

**Read history before working** — `git log --oneline -20` at session start.
**File history** — `git log --oneline -- <path>` to understand why.
**Branch scope** — `git diff main...HEAD --stat` for current changes.
**History over stale prose** — code + git history wins. Update the doc.
**Agent worktrees** — create new manual task worktrees under `.worktrees/<task-slug>/` from
`origin/dev` unless a task explicitly says otherwise. Existing external worktrees may finish in
place. Worktrees are disposable after merge.

## Git Commits

**Conventional commits** — `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`
**Multi-line messages** for detailed context. **Never --no-verify**.
**Wrap commit body lines at 100 chars or less** to satisfy commitlint.
**Prefer a commit message file for multi-line commits** (`git commit -F /tmp/message.txt`) so body
wrapping is visible before hooks run. Use repeated `-m` flags only for short body lines already
checked to be 100 chars or less.
**Do not retry a failed commit with the same message shape** after commitlint rejects it. Rewrite the
message with wrapped body lines first.

**Git lock recovery:** if `/.git/index.lock` is present, first assume an interrupted or overlapping
Git operation rather than corruption. Check that no Git process is still running, then remove the
stale lock with `rm -f .git/index.lock` before retrying. Avoid starting a new commit while hook
formatters or other Git operations are still in flight.

## Pull Requests

**Template required** — before opening or editing a PR, read `.github/pull_request_template.md`
and preserve every required heading exactly.
**Check after editing** — after opening or editing a PR, run
`gh pr checks <pr-number> --repo plaited/plaited`.
**Fix description lint** — if `pr-description-lint` fails, inspect the failing job with
`gh run view` and update the PR body with `gh pr edit` until the required heading check passes.

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
- if `skills/<name>/scripts` changed, run that skill's tests plus any shared `src/` tests those
  scripts depend on
- if a `src/<feature>` CLI command changed, run that feature's tests plus CLI/schema tests as needed
- if only `src/ui/` changed, run the relevant UI test surfaces
- if shared code changed and the impact is broad or unclear, expand test coverage until the
  affected surface is credibly covered

`docs:` and `chore:` commits may skip executable validation when they do not change behavior.

## Directory Boundaries

**`src/`** — Framework code that ships with the package: runtime modules, schemas, types, and
stable CLI-backed features.
**CLI features** — Prefer a `makeCli` JSON-in/JSON-out command exported through the owning
`src/<feature>/` module and registered in `bin/plaited.ts`.
**`scripts/`** — Repo setup and package-maintenance shell glue.
**`skills/`** — Implementation patterns and skill-local tools. Skill scripts, prompts,
references, tests, and assets stay under their skill directory.

**Operator surface** — Stable agent/operator features should be discoverable through
`plaited --schema` and invokable as `plaited <command> '<json>'`.

## GitHub CLI

**Always use `gh` for GitHub URLs** — `gh api`, `gh pr view`, `gh issue view`. Never WebFetch for GitHub content.


# Context Repository

**Source of Truth Hierarchy:**

| Source | Role |
|--------|------|
| `src/` code + types | What the system IS |
| `git log` | Why it changed |
| `AGENTS.md` | How to work here (rules) |
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
- Feature files use dash-case: `resolve-relative-path.ts`, `limit-text-bytes.ts`, `key-mirror.ts`
- Name the file after its primary export: `resolveRelativePath` → `resolve-relative-path.ts`
- Main entry uses module name: `behavioral.ts`, `server.ts`, `controller.ts`
- **Never prefix feature files with the directory name** — the directory already provides context

**File organization:**
- `feature.types.ts` — types only
- `feature.schemas.ts` — Zod schemas + `z.output<>` types
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
**CLI schema semantics** — any Zod schema exposed through CLI `--schema input|output` must use
`.describe(...)` on the top-level schema and meaningful fields so agent consumers get semantic context.
**Avoid `superRefine` for core schema shape** — prefer structural schemas (discriminated unions,
`oneOf`-equivalent branches, and strict object composition) so constraints are explicit, type narrowing
is reliable, and JSON-schema replay contracts stay aligned.
**Avoid parallel schema sources** — do not hand-maintain raw JSON-schema objects alongside equivalent
Zod schemas. Prefer deriving JSON Schema from Zod (`z.toJSONSchema(...)`) unless an external consumer
requires a specific non-emitted JSON shape.
**Arrow functions** — `const fn = () =>` over `function fn()`.
**Object params >2 args** — `fn({ a, b, c }: { ... })`.
**Private fields** — `#field` (ES2022) not `private field`.
**JSON imports** — `import x from 'file.json' with { type: 'json' }`.
**@ts-ignore needs description** — `// @ts-ignore - reason here`.
**Behavioral handlers:** do not use local `try/catch` for validation or side-effect errors
inside `addHandler`/feedback handlers unless explicitly converting a known domain failure into a
normal result event. Let behavioral publish `feedback_error` snapshots for handler failures.
**Mermaid diagrams only** — no ASCII box-drawing.
**Skill checks** — use `plaited skills` for skill discovery, validation, and registry checks. Do
not invent standalone skill validators unless the repo exposes them.

## Runtime Wiring Style

Prefer direct callsite wiring when logic is local, stable, and used once.

- Do not add wrapper helpers that only rename or pass through one existing function.
- Do not extract one-off shell commands, single-use event handlers, or small runtime checks into
  local helpers just to "clean up" the callsite. Keep them inline unless the extraction removes
  real duplication or improves correctness.
- Do not replace a short set of direct event registrations with forwarding maps, event lists,
  or similar indirection unless there is a demonstrated maintenance benefit.
- Keep runtime boundary code explicit at callsites:
  - IPC handlers
  - event emitter wiring
  - path resolution at security-sensitive boundaries
  - process/worker lifecycle wiring
- Prefer tests that exercise the real runtime boundary (process, IPC, event, lifecycle behavior)
  over helper-only tests that bypass the contract.
- Small abstractions are justified only when they remove real duplication across multiple
  callsites, materially improve correctness, encode a real domain concept, or improve testing
  without hiding the runtime contract.

Preferred:
```ts
emitter.on(SESSION_EVENTS.stdout, onStdout);
const contextDbPath = resolveRelativePath({ cwd, path: '.plaited/context.sqlite' });
process.on('message', (raw) => {
  const parsed = parseIpcMessage(raw);
  if (!parsed) return;
  handleMessage(parsed);
});
```

Discouraged:
```ts
const resolveContextDbPath = (cwd: string) =>
  resolveRelativePath({ cwd, path: '.plaited/context.sqlite' });
EVENT_FORWARDERS.forEach(({ event, handler }) => emitter.on(event, handler));
test('parse helper', () => expect(parseMessage(raw)).toEqual(parsed));
```

# Skill Pointers

**TSDoc** — use `code-documentation` skill for conventions when writing/editing TSDoc.
**BP patterns** — use `plaited-runtime` skill when implementing behavioral programs.
**UI development/testing** — use `plaited-ui` for controller protocol, custom
elements, SSR, and the three-layer UI test strategy.
