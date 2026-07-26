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

The three functions above are the importable surface. `frontier-analysis.ts`
exports more — the graph internals that `verifyFrontiers` composes
internally (`findStronglyConnectedComponents`, `findLivelocks`, `isCycle`,
`frontierStateKey`, `StateNode`). These are not re-exported from `plaited`;
reach them by reading `src/behavioral/frontier-analysis.ts` and fetching each
export's TSDoc with the TypeScript LSP CLI.

### Enumerate the file's public exports

```bash
plaited typescript-lsp '{"mode":"execute","file":"src/behavioral/frontier-analysis.ts","requests":[{"method":"textDocument/documentSymbol","params":{"textDocument":{"uri":"file://src/behavioral/frontier-analysis.ts"}}}]}'
```

Returns each symbol with its kind (`Function`/`TypeAlias`/`Interface`) and
position. Pick the symbol you need, then fetch its TSDoc + signature with
`hover`:

### Fetch one symbol's TSDoc and type

```bash
plaited typescript-lsp '{"mode":"execute","file":"src/behavioral/frontier-analysis.ts","requests":[{"method":"textDocument/hover","params":{"textDocument":{"uri":"file://src/behavioral/frontier-analysis.ts"},"position":{"line":478,"character":13}}}]}'
```

Returns the `/** ... */` block plus the resolved type signature — that is the
deeper "what it does / how to debug it" content for the symbol. Each export's
TSDoc names its algorithm (e.g. iterative Tarjan SCC) and the decision rules
and failure modes relevant to a caller. Use this rather than re-reading the
whole file.

### Getting the position right (common mistakes)

`position` is **0-indexed** — `line: 478` is the 479th line. Get the exact
line from `documentSymbol` output (the `range.start` it returns is also
0-indexed), not by counting in your editor.

`hover` requires `position`; `documentSymbol` does not. These are easy to
mix up:

✓ `hover` with `position` → the TSDoc at that symbol.
✗ `hover` **without** `position` → empty/whole-file result, not an error.
✗ `documentSymbol` **with** `position` → ignored; still returns all symbols.

`method` lives inside `requests[]`, not at the top level:

✓ `{"mode":"execute","file":"...","requests":[{"method":"textDocument/hover","params":{...}}]}`
✗ `{"mode":"execute","file":"...","method":"textDocument/hover"}` → `method` is
  silently dropped (not a documented field of the input) and the request does
  nothing.

### Where the algorithm names come from

When a `hover` TSDoc names an algorithm (e.g. "iterative Tarjan SCC") and you
suspect the implementation itself is wrong — not your call, but the function —
that name is the minimal information for filing an issue or opening a PR. Use
`plaited typescript-lsp` (`definition`, `references`) to locate and read the
implementation, or cite the algorithm name and the observed wrong result. The
TSDoc deliberately omits algorithm internals; it gives you what to use the
function and what to name in a bug report, not how to audit it.

## See also

- [`plaited typescript-lsp --help`](../typescript-lsp/SKILL.md) — the LSP CLI
  used by the going-deeper workflow.
