# Frontier Analysis

Reference for an agent assisting an engineer in wiring up the Plaited
behavioral-program verification tools. These tools answer two questions
across **every reachable state** of a behavioral program, not just sampled
runs: *can it deadlock?* and *can it spin forever without making progress?*

## Public surface (import from `plaited`)

The consumer API is re-exported from the package root:

```ts
import {
  replayToFrontier,
  exploreFrontiers,
  verifyFrontiers,
  type ExploreFrontiersArgs,
  type ExploreFrontiersResult,
  type VerifyFrontiersArgs,
  type VerifyFrontiersResult,
  type DeadlockFinding,
  type LivelockFinding,
  type TraceRecord,
} from 'plaited'
```

Everything below is reachable from this import. (Deeper graph internals —
`findStronglyConnectedComponents`, `findLivelocks`, `frontierStateKey`,
`StateNode` — are **not** re-exported from `plaited`; see
[Going deeper](#going-deeper) for how to reach them.)

Threads are JSON objects: `{ label: string, rules: Idioms[], once?: true }`. Each
idiom is one sync point with `request` (propose an event), `waitFor` (block
until an event), `block` (forbid an event), and/or `interrupt` (terminate the
thread on an event). `detailSchema` on listeners is JSON Schema, compiled at
registration.

## When to use which function

| Need | Use |
|------|-----|
| Inspect one known event sequence and the frontier that follows | `replayToFrontier` |
| Enumerate reachable histories, find deadlocks, get the state graph | `exploreFrontiers` |
| Pass/fail/truncated summary — "is this program deadlock- or livelock-free?" | `verifyFrontiers` |

**`replayToFrontier`** replays a concrete selection trace and returns the
resulting pending set and frontier. Use it first when you already have a
suspected event sequence (e.g. from a trace dump). It **throws** if a
selection wasn't enabled at its step — so a successful replay proves the
sequence was valid.

**`exploreFrontiers`** enumerates every reachable state by replaying all
event-selection branches. State-keyed deduplication means **finite-state
looping programs terminate** without relying on `maxDepth`: the graph closes
once every distinct pending-set state has been visited. `maxDepth` bounds
only genuinely infinite-state programs and sets `report.truncated` honestly
when it cuts off. Returns traces, deadlock findings, and the labeled
`stateGraph` for downstream analysis.

**`verifyFrontiers`** is the high-level verdict. It runs `exploreFrontiers`
and derives a `verified` / `failed` / `truncated` status. With the optional
`progress` spec it also runs livelock detection: a cycle that never selects
a progress event is a livelock.

### `verifyFrontiers` — the progress spec

```ts
import { verifyFrontiers } from 'plaited'

const result = verifyFrontiers({
  threads,
  progress: ['succeeded', 'completed'], // event types that count as progress
  maxDepth: 50,
})
// result.status: 'verified' | 'failed' | 'truncated'
// result.findings: DeadlockFinding[]   (deadlocks)
// result.livelocks: LivelockFinding[]  (cycles with no progress event)
```

The `progress` distinction matters when diagnosing results:

- **Omit `progress`** → livelock is **not checked**; only deadlocks. Same
  behavior as before livelock support existed. Use this when you only care
  about deadlock-freedom.
- **`progress: []`** (empty array) → **nothing** counts as progress, so
  every reachable cycle is a livelock. Rarely what you want; useful as a
  "find every cycle" probe.
- **`progress: ['eventType', ...]`** → a cycle is a livelock iff none of its
  in-cycle edges select one of the listed types. Edges that **leave** the
  cycle don't count — an escape is not progress made inside the cycle.

Status precedence: a deadlock or livelock finding yields `'failed'` even if
exploration was also truncated. A pure truncation (no findings, `maxDepth`
hit) yields `'truncated'`. Only a clean, fully-explored, finding-free run
yields `'verified'`. **Never treat `'truncated'` as a pass** — it means the
verifier gave up before proving anything.

## A common wiring mistake to avoid

Calling `verifyFrontiers` (or `exploreFrontiers`) **without `maxDepth`** on a
program with unbounded state (e.g. a thread that requests an event with a
counter `detail` that grows each loop) will not terminate — the state graph
never closes. For finite-state programs (all `once: true`, or loops with
bounded `detail`) you can safely omit `maxDepth`. For anything else, set
`maxDepth` and treat `truncated` as "needs a bound or an abstraction," not a
failure of the tool.

## Going deeper

The public surface above is importable. Deeper internals are reachable by
resolving the public specifier to its backing file and inspecting with the
TypeScript LSP CLI — no hardcoded source paths, so the examples survive
refactors that move impl files.

### Resolve the specifier and enumerate exports

```bash
# Step 1 — resolve the specifier to its backing file (barrel)
bun -e 'console.log(Bun.resolveSync("plaited", process.cwd()+"/"))'
# → /path/to/src/main.ts

# Step 2 — read the barrel to find the backing module that exports your symbol
# The barrel re-exports: export * from './main/behavioral.ts'
#                       export type * from './main/behavioral.types.ts'
#                       export { exploreFrontiers, ... } from './main/frontier-analysis.ts'
#                       export * from './main/renderer.ts'
# Pick the module that declares the symbol you need (e.g. src/main/frontier-analysis.ts)

# Step 3 — enumerate the backing module's symbols with documentSymbol
plaited typescript-lsp '{"mode":"execute","file":"<resolved-path>","requests":[{"method":"textDocument/documentSymbol","params":{"textDocument":{"uri":"file://<resolved-path>"}}}]}'
```

`documentSymbol` returns each symbol in the backing module with its kind
and `range.start` location — hover the symbol you want using the position
from the output (no hardcoded line numbers).

### Fetch one symbol's TSDoc and type

```bash
# Step 4 — fetch one symbol's TSDoc and type (use range.start from Step 3 as the position)
plaited typescript-lsp '{"mode":"execute","file":"<resolved-path>","requests":[{"method":"textDocument/hover","params":{"textDocument":{"uri":"file://<resolved-path>"},"position":{"line":0,"character":0}}}]}'
```

Returns the `/** ... */` block plus the resolved type signature — the deeper
"what it does / how to debug it" content for the symbol.

### Getting the position right (common mistakes)

`hover` requires `position`; `documentSymbol` does not. These are easy to
mix up:

✓ `hover` with `position` → the TSDoc at that symbol.
✗ `hover` **without** `position` → empty/whole-file result, not an error.
✗ `documentSymbol` **with** `position` → ignored; still returns all symbols.

`method` lives inside `requests[]`, not at the top level:

✓ `{"mode":"execute","file":"...","requests":[{"method":"textDocument/hover","params":{...}}]}`
✗ `{"mode":"execute","file":"...","method":"textDocument/hover"}` → `method` is
  silently dropped and the request does nothing.

## See also

- [`plaited typescript-lsp --help`](../../typescript-lsp/SKILL.md) — the LSP CLI
  used by the going-deeper workflow.
