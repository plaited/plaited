# Frontier Analysis

Reference for an agent assisting an engineer in wiring up the Behavioral
behavioral-program verification tools. These tools answer two questions
across **every reachable state** of a behavioral program, not just sampled
runs: *can it deadlock?* and *can it spin forever without making progress?*

## Public surface

Frontier analysis is three `useTool` units that live in-repo at
`src/tools/frontier.ts`. Their input/output schemas are re-exported via the
`@behavioral/sh/tools` package export; the tool **instances** and the
`Frontier*Input` / `Frontier*Output` types are in-repo only (not public
package exports):

```ts
// Schemas (public package export)
import {
  FrontierReplayInputSchema,
  FrontierReplayOutputSchema,
  FrontierExploreInputSchema,
  FrontierExploreOutputSchema,
  FrontierVerifyInputSchema,
  FrontierVerifyOutputSchema,
  type UseTool,
  useTool,
} from '@behavioral/sh/tools'

// Tool instances + types (in-repo source)
import {
  frontierReplay,
  frontierExplore,
  frontierVerify,
  type FrontierReplayInput,
  type FrontierReplayOutput,
  type FrontierExploreInput,
  type FrontierExploreOutput,
  type FrontierVerifyInput,
  type FrontierVerifyOutput,
} from '../../tools/frontier.ts'
```

The raw algorithm functions (`replayToFrontierRaw`, `exploreFrontiersRaw`,
`verifyFrontiersRaw`) and the graph internals (`frontierStateKey`,
`findStronglyConnectedComponents`, `findLivelocks`, `StateNode`) are
**module-private** — the three tools below are the only public surface.

Threads are JSON objects: `{ label: string, rules: Idioms[], once?: true }`.
Each idiom is one sync point with `request` (propose an event), `waitFor`
(block until an event), `block` (forbid an event), and/or `interrupt`
(terminate the thread on an event). `detailSchema` on listeners is JSON
Schema, compiled at registration.

## When to use which tool

| Need | Tool name |
|------|-----------|
| Inspect one known event sequence and the frontier that follows | `frontier-replay` |
| Enumerate reachable histories, find deadlocks, get the state graph | `frontier-explore` |
| Pass/fail/truncated verdict — "is this program deadlock- or livelock-free?" | `frontier-verify` |

**`frontier-replay`** replays a concrete selection trace and returns the
resulting frontier, the canonical pending-state key, and the pending-bid
count. Use it first when you already have a suspected event sequence (e.g.
from a trace dump). If a selection wasn't enabled at its step, the tool
returns `{ isError: true, message }` instead of throwing — a successful
replay proves the sequence was valid.

**`frontier-explore`** enumerates every reachable state by replaying all
event-selection branches. State-keyed deduplication means **finite-state
looping programs terminate** without relying on `maxDepth`: the graph closes
once every distinct pending-set state has been visited. `maxDepth` (required)
bounds only genuinely infinite-state programs and sets `report.truncated`
honestly when it cuts off. Returns traces, deadlock findings, the report,
and the labeled `stateGraph` (serialized to a plain object keyed by
`stateKey`) for downstream analysis.

**`frontier-verify`** is the high-level verdict. It runs the exploration and
derives a `verified` / `failed` / `truncated` status. With the optional
`progress` spec it also runs livelock detection: a cycle that never selects a
progress event is a livelock.

## The tools

### `frontier-replay`

```ts
const out = frontierReplay({
  threads,        // Thread[] — required
  messages,       // SelectionTrace[] — selection prefix to replay (optional)
  space,          // space stamp applied to all thread rules (optional)
  instanceId,     // stamped on synthetic traces; defaults to ueid('bp_') (optional)
})
// out: { frontier, stateKey, pendingCount } on success
//      { frontier: null, stateKey: null, pendingCount: null, isError, message } on a disabled selection
```

`frontier` is the resulting frontier (`{ status, candidates, enabled }`);
`stateKey` is the canonical string key for the pending set; `pendingCount` is
the number of pending bids. The pending `Set` (with generator closures) is
serialized away — only JSON-safe values cross the boundary.

### `frontier-explore`

```ts
const out = frontierExplore({
  threads,          // Thread[] — required
  messages,         // SelectionTrace[] — prior trace prefix (optional)
  triggers,         // BPEvent[] — external triggers that may wake pending threads (optional)
  strategy,         // 'bfs' | 'dfs' — default 'bfs' (optional)
  selectionPolicy,  // 'all-enabled' | 'scheduler' — default 'all-enabled' (optional)
  maxDepth,         // number — REQUIRED. Bounds unbounded-state programs.
  space,            // space stamp (optional)
  instanceId,       // stamped on synthetic traces (optional)
})
// out: { traces, findings, report, stateGraph }
//      traces:  Array<{ messages: Trace[] }>  — one per reachable state
//      findings: Array<{ code: 'deadlock', messages: Trace[] }>
//      report:   { strategy, selectionPolicy, visitedCount, findingCount, truncated, maxDepth? }
//      stateGraph: Record<stateKey, { stateKey, frontier, step, successors }>
```

`selectionPolicy: 'all-enabled'` branches on every enabled candidate;
`'scheduler'` takes only the highest-priority one (mirrors the engine's
priority-queue selection). The `stateGraph` is the serialized `Map<string,
StateNode>` — object form keyed by `stateKey`, insertion-ordered (root state
first).

### `frontier-verify`

```ts
const out = frontierVerify({
  threads,          // Thread[] — required
  messages,         // SelectionTrace[] (optional)
  triggers,         // BPEvent[] (optional)
  strategy,         // 'bfs' | 'dfs' — default 'bfs' (optional)
  selectionPolicy,  // 'all-enabled' | 'scheduler' — default 'all-enabled' (optional)
  maxDepth,         // number — REQUIRED.
  progress,         // string[] — event types that count as progress (optional)
  space,            // space stamp (optional)
  instanceId,       // stamped on synthetic traces (optional)
})
// out: { status, findings, report, livelocks }
//      status:    'verified' | 'failed' | 'truncated'
//      findings:  Array<{ code: 'deadlock', messages: Trace[] }>
//      livelocks: Array<{ code: 'livelock', states: string[], progressTypes: string[] }>
//      report:    same shape as frontier-explore's report
```

### The `progress` spec

The `progress` distinction matters when diagnosing results:

- **Omit `progress`** → livelock is **not checked**; only deadlocks. Use this
  when you only care about deadlock-freedom.
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

Calling `frontier-verify` (or `frontier-explore`) **without `maxDepth`** on a
program with unbounded state (e.g. a thread that requests an event with a
counter `detail` that grows each loop) will not terminate — the state graph
never closes. `maxDepth` is **required** on both tools for this reason. For
finite-state programs (all `once: true`, or loops with bounded `detail`) the
graph closes via state-key dedup and the tool terminates before `maxDepth`.
For anything else, set `maxDepth` and treat `truncated` as "needs a bound or
an abstraction," not a failure of the tool.

## See also

- [behavioral](./behavioral.md) — the runtime whose `Trace` union these tools
  filter on, and the `Thread` shape they take.
- [eval](./eval.md) — capturing a run's `Thread[]` + messages for later
  frontier analysis.
