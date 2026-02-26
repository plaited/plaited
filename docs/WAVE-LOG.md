# Agent Implementation — Wave Log

Incremental implementation log for the Plaited agent layer. Each wave is a self-contained increment that leaves all tests green.

**Current total: 1151 tests passing** across 79 files.

---

## Outstanding Issues

Issues identified after all 6 waves shipped. None are blockers — the framework is functionally complete.

### Stale TSDoc Comments

All resolved. `GateDecision`, `RISK_CLASS`, and `TrajectoryStep` TSDoc updated to reflect current implementation.

### Deferred Features

| Feature | Deferred From | Notes |
|---------|--------------|-------|
| ~~**Eval harness canonical imports**~~ | Wave 2 | Resolved — eval harness now imports `ThoughtStepSchema`, `MessageStepSchema`, `ToolCallStepSchema` from agent; `PlanStepSchema` intentionally diverges |
| **LSP → semantic search pipeline** | Wave 3 | Memory has FTS5 search; LSP and semantic search layers never built |
| **`searchGate` bThread** | Wave 3 | Planned to block search results during active tool execution; not implemented |
| **Runtime constitution rule addition via public API** | Wave 6 | `bThreads.set()` works directly for power users; no convenience method on `AgentLoop` |
| **JSON/TOML config file loading for constitution** | Wave 6 | `constitutionRule()` accepts programmatic config objects; file loading deferred |
| **Subprocess sandboxing** | Wave 1 | Tool execution is in-process; sandbox is a deployment concern (srt, Landlock, gVisor) |

### Code Quality Notes

All resolved:

- **Orchestrator IPC handler** — Replaced `wireIpcBridge()` handler replacement with single permanent handler using `bridgeActive` flag. Eliminates the last-writer-wins race window.
- **Unit tests** — Added 24 tests in `agent.utils.spec.ts` (`createInferenceCall`, `parseModelResponse`, `createTrajectoryRecorder`) and 5 tests in `simulate.spec.ts` (`createSubAgentSimulate`).

---

## Wave 7: BP-First Architecture + Full Snapshot Context

**Branch:** `feat/agent-loop-build`
**Date:** 2026-02-26

### Context

After Wave 6, a review of `agent.ts` revealed over-reliance on imperative conditionals in feedback handlers instead of using BP's structural coordination. The `SnapshotContextLevel` three-level approach was backward-compatibility engineering for greenfield code with zero consumers. Wave 7 simplifies the architecture: drop unnecessary generics, flatten conditional routing into uniform pipelines, and let handlers do one thing each.

### What Shipped

#### 1. Dropped `AgentEventDetails` Generic

`behavioral<AgentEventDetails>()` → `behavioral()`. The mapped type `Handlers<AgentEventDetails>` required exhaustive handler coverage (every event key = required property), which forced 15 noop stubs like `[AGENT_EVENTS.context_ready]: () => {}`. At runtime, `useFeedback` uses `Object.hasOwn(handlers, type)` and skips missing handlers — the stubs were pure noise.

- Removed `AgentEventDetails` from generic parameter (kept as reference documentation type)
- Removed 15 noop stubs across primary + observer handlers (~30 lines)
- Handlers self-validate where detail shape matters; `DefaultHandlers` accepts any string key

#### 2. Uniform Simulate → Evaluate → Execute Pipeline

Replaced `routeToSimulate` conditional closure (checked `simulate` seam at creation time) with uniform `triggerSimulate` that always routes through the pipeline:

- `route_side_effects` and `route_high_ambiguity` → always trigger `simulate_request`
- `simulate_request` handler: calls simulate seam or passes through with empty prediction
- `simulation_result` handler: calls evaluate seam or triggers `eval_approved`
- Events flow through the full pipeline — handlers pass through when seams are absent

#### 3. Dual-Layer Symbolic Safety

Moved `checkSymbolicGate` from `simulation_result` handler to `eval_approved` handler. The old placement was a duplicate of the `symbolicSafetyNet` bThread's blocking logic, but at the wrong stage — it couldn't produce a feedback event when blocking.

New dual-layer design:
- **Handler layer** (`eval_approved`): checks prediction, routes to `eval_rejected` for model feedback
- **bThread layer** (`symbolicSafetyNet`): blocks `execute` as defense-in-depth

This mirrors the constitution dual-layer pattern. Blocked events are silently dropped in BP — without the handler layer, the model never learns why its tool call disappeared, and `batchCompletion` hangs waiting for a completion event that never fires.

#### 4. Always-Full Snapshot Context

Removed `SnapshotContextLevel` three-level approach. `buildContextMessages` always provides:
- **Selection history** — last 10 BP selection steps (who won, who was blocked, priorities)
- **Diagnostics** — feedback errors, restricted trigger rejections, thread warnings (ring buffer, cap 50)

#### 5. Snapshot Context Test Coverage

10 new tests in `agent.utils.spec.ts`:
- `formatSelectionContext`: windowing (>10 steps with omission notice), grouping blocked bids, empty eventLog
- `formatDiagnostics`: all 3 diagnostic kinds (`feedback_error`, `restricted_trigger_error`, `bthreads_warning`), mixed kinds, empty array
- Combined: both selection history + diagnostics in single system prompt

### File Inventory

| File | Action | Purpose |
|------|--------|---------|
| `src/agent/agent.ts` | MODIFIED | Drop generic, remove noops, flatten routing, dual-layer symbolic safety |
| `src/agent/agent.types.ts` | MODIFIED | Update `AgentEventDetails` TSDoc (reference-only, not generic param) |
| `src/agent/agent.constants.ts` | MODIFIED | Update TSDoc comment |
| `src/agent/agent.utils.ts` | MODIFIED | Remove `SnapshotContextLevel`, always-full `buildContextMessages` |
| `src/agent/tests/agent.spec.ts` | MODIFIED | Update symbolic safety test comment |
| `src/agent/tests/agent.utils.spec.ts` | MODIFIED | +10 snapshot context tests |

### Verification

- **132 agent tests pass** across 4 files (213ms)
- **0 type errors** (`tsc --noEmit` clean)

### Design Decisions

1. **Unparameterized `behavioral()` over type assertions.** Instead of `as Handlers<AgentEventDetails>` to work around the exhaustive-key requirement, we removed the generic entirely. `DefaultHandlers` (`Record<string, (detail: any) => void>`) accepts partial handler objects naturally. Handlers self-validate with Zod where detail shape matters. This is simpler, loses no runtime safety, and aligns with BP's additive composition (wire up what you need, ignore the rest).

2. **Pipeline pass-through over conditional bypass.** Instead of `if (!simulate) trigger(execute)` at the routing level, events always flow through simulate → evaluate → execute. Each handler does its single job (call seam or pass through). This eliminates 3 conditionals and makes the event flow uniform — adding/removing seams doesn't change routing logic.

3. **`eval_approved` is the symbolic checkpoint, not `simulation_result`.** The symbolic gate check belongs at the last handler before `execute` — the natural gatekeeper position. `simulation_result`'s job is to call the evaluate seam, not to re-check what a bThread already blocks. The dual-layer pattern (handler for feedback, bThread for defense-in-depth) is consistent with constitution design.

4. **Blocked events need feedback partners.** Pure blocking bThreads (like `symbolicSafetyNet`) silently drop events — BP doesn't queue or notify. When the blocked event is counted by another thread (like `batchCompletion`), the system hangs. The pattern: pair every blocking bThread with a handler-level check that produces a rejection event. The bThread is defense-in-depth; the handler is the primary routing mechanism.

### Key Pattern Discovered: Three-Layer Architecture

Blocks and interrupts are **fully observable** via `useSnapshot` — `SelectionBid.blockedBy` and `SelectionBid.interrupts` record exactly which thread blocked or interrupted which event. The snapshot is persisted to SQLite and fed to the model's system prompt via `formatSelectionContext`. Three distinct layers, each non-substitutable:

| Layer | Purpose | Mechanism |
|-------|---------|-----------|
| **Snapshot** | Observability — model sees who blocked/interrupted what | `SelectionBid.blockedBy`, `SelectionBid.interrupts` → SQLite → system prompt |
| **Handler** | Workflow coordination — produce events for counting threads | Routes to rejection event (batchCompletion counts) |
| **bThread** | Structural safety — defense-in-depth | Blocks execute, observable but doesn't produce workflow events |

**Why handlers can't be replaced by bThreads alone:** A blocked event doesn't produce a workflow event. If `batchCompletion` is counting N completions and one is blocked, the batch deadlocks. The handler produces the rejection event that batchCompletion counts. The bThread catches anything the handler misses.

---

## Wave 8: Per-Call Dynamic Threads + Snapshot Observability

**Branch:** `feat/ui-layer`
**Date:** 2026-02-26

### Context

Wave 7 introduced the dual-layer safety pattern but framed blocks as "silent." Review revealed this was wrong — blocks and interrupts are fully observable via `SelectionBid.blockedBy` and `SelectionBid.interrupts` in snapshots. Additionally, `simulationGuard` and `symbolicSafetyNet` relied on shared mutable state (`simulatingIds` Set, `simulationPredictions` Map) read by persistent block predicates. Wave 8 replaces these with per-call dynamic threads using predicate interrupts — following the same pattern as `maxIterations` and `batchCompletion`.

### What Shipped

#### 1. Per-Call Simulation Guard (`sim_guard_{id}`)

Replaced persistent `simulationGuard` bThread (reading from shared `simulatingIds` Set) with per-call dynamic threads:

```typescript
// Added in triggerSimulate(), scoped to specific tool call ID
bThreads.set({
  [`sim_guard_${id}`]: bThread([
    bSync({
      block: (e) => e.type === 'execute' && e.detail?.toolCall?.id === id,
      interrupt: [(e) => e.type === 'simulation_result' && e.detail?.toolCall?.id === id],
    }),
  ]),
})
```

- Block prevents execution while simulation is pending
- Predicate interrupt terminates thread when this specific tool call's `simulation_result` fires
- Eliminates `simulatingIds` shared mutable state entirely
- Observable: `SelectionBid.blockedBy: "sim_guard_tc-1"` and `SelectionBid.interrupts: "sim_guard_tc-1"`

#### 2. Per-Call Symbolic Safety (`safety_{id}`)

Replaced persistent `symbolicSafetyNet` bThread (reading from shared `simulationPredictions` Map) with per-call dynamic threads:

```typescript
// Added in simulate_request handler, only when prediction is dangerous
if (checkSymbolicGate(prediction, patterns).blocked) {
  bThreads.set({
    [`safety_${tcId}`]: bThread([
      bSync({
        block: (e) => e.type === 'execute' && e.detail?.toolCall?.id === tcId,
        interrupt: [(e) =>
          (e.type === 'eval_rejected' && e.detail?.toolCall?.id === tcId) ||
          (e.type === 'tool_result' && e.detail?.result?.toolCallId === tcId)
        ],
      }),
    ]),
  })
}
```

- Only created when prediction IS dangerous (not for every tool call)
- Interrupted when the tool call resolves (rejected or executed)
- Defense-in-depth alongside `eval_approved` handler's `checkSymbolicGate`

#### 3. Eliminated Shared Mutable State from Block Predicates

- Removed `simulatingIds` Set entirely
- `simulationPredictions` Map retained only for handler-level check in `eval_approved` (not read by any bThread predicate)

### File Inventory

| File | Action | Purpose |
|------|--------|---------|
| `src/agent/agent.ts` | MODIFIED | Per-call threads, remove simulatingIds, per-call safety threads |

### Verification

- **1151 tests pass** across 79 files (68.61s)
- **0 type errors** (`tsc --noEmit` clean)

### Design Decisions

1. **Per-call dynamic threads over persistent shared-state threads.** Instead of a single persistent thread reading from a mutable `Set`/`Map`, each tool call gets its own guard thread. The thread is scoped by ID and self-terminates via predicate interrupt. This follows the same pattern as `maxIterations` and `batchCompletion` — dynamic, per-scope threads with explicit interrupt-based lifecycle.

2. **Predicate interrupts for lifecycle management.** `interrupt: [(e) => e.type === 'simulation_result' && e.detail?.toolCall?.id === id]` — the interrupt idiom accepts `BPListener` predicates, not just string event types. This allows scoping interrupt to a specific tool call, eliminating the need for shared state to track which calls are in-flight.

3. **Safety threads created conditionally.** `safety_{id}` threads are only added when `checkSymbolicGate` reports the prediction is dangerous. Non-dangerous predictions don't get a safety thread — no unnecessary overhead.

4. **Snapshot observability corrects the "silent block" framing.** Blocks are not silent — `SelectionBid.blockedBy` records the blocking thread, persisted to SQLite, shown in model context. The handler layer exists for workflow coordination (producing events batchCompletion counts), not for observability.

### Key Pattern: Interrupt as Structural Lifecycle

`interrupt` is not just for task-end cleanup (`message` kills `maxIterations`). It's a general lifecycle management tool:

| Thread | Interrupt Trigger | Lifecycle Meaning |
|--------|------------------|-------------------|
| `maxIterations` | `message` | Task ended |
| `batchCompletion` | `message` | Task ended mid-batch |
| `sim_guard_{id}` | `simulation_result` (predicate) | Simulation completed for this call |
| `safety_{id}` | `eval_rejected` or `tool_result` (predicate) | Tool call resolved |

Each interrupt is observable via `SelectionBid.interrupts` in snapshots.

---

## Wave 6: Constitution as bThreads

**Branch:** `feat/agent-loop-build`
**Date:** 2026-02-23
**Commit:** `5049d09`

### Context

Waves 1–5 built a complete agent loop with orchestration (309 tests). The constitution (`createGateCheck`) was purely imperative — a synchronous function that iterates `customChecks` and short-circuits on rejection. Wave 6 converts safety rules into independent bThreads that compose additively via BP's blocking mechanism.

### What Shipped

#### 1. Constitution Types (`agent.constitution.types.ts`)

- **`ConstitutionRule`** — Predicate-based rule: `{ name, description?, test: (toolCall) => boolean }`. Test returns `true` = BLOCKED.
- **`ConstitutionRuleConfig`** — JSON-serializable config: `{ name, blockedTools?, pathPattern?, argPattern? }`. Converted to `ConstitutionRule` via `constitutionRule()`.
- **`Constitution`** — Return type of `createConstitution()`: `{ threads: Record<string, RulesFunction>, gateCheck: GateCheck }`.

#### 2. Constitution Factory (`agent.constitution.ts`)

**`createConstitution(rules)`** — dual-layer safety:

- **Layer 1 — bThreads (defense-in-depth):** Each rule becomes a `constitution_{name}` bThread with `repeat: true` that blocks `execute` events matching its predicate. Consistent with existing `symbolicSafetyNet` pattern.
- **Layer 2 — imperative gateCheck (feedback):** Returns a `GateCheck` function that runs the same rules. Called in `proposed_action` handler, routes violations to `gate_rejected` which provides feedback to the model.

**`constitutionRule(config)`** — converts JSON-serializable config into a `ConstitutionRule`. Supports three fields combined with OR logic: `blockedTools` (exact name match), `pathPattern` (regex on `arguments.path`), `argPattern` (regex on `arguments[key]`).

#### 3. Agent Loop Integration (`agent.ts`)

- `createAgentLoop` accepts optional `constitution: ConstitutionRule[]` parameter
- Constitution gateCheck composes with custom gateCheck (constitution runs first, short-circuits on rejection)
- Constitution bThreads spread into `bThreads.set()` alongside existing threads
- `proposed_action` handler uses `composedGateCheck` (constitution + custom)

### File Inventory

| File | Action | Purpose |
|------|--------|---------|
| `src/agent/agent.constitution.types.ts` | NEW | ConstitutionRule, ConstitutionRuleConfig, Constitution types |
| `src/agent/agent.constitution.ts` | MODIFIED | Added createConstitution + constitutionRule (+100 lines) |
| `src/agent/agent.ts` | MODIFIED | constitution param, gate composition, thread spread (+29 lines) |
| `src/agent/tests/agent.constitution.spec.ts` | MODIFIED | +19 tests (factory, config utility, BP integration) |
| `src/agent.ts` | MODIFIED | Added type re-export for constitution types |

### Verification

- **322 tests pass** across 25 files (884ms)
- **0 new type errors** (2 pre-existing in `node_modules/@plaited/agent-eval-harness`)
- **0 new lint errors** (1 pre-existing `console.log` warning in `skills/ui-testing/`)

### Design Decisions

1. **Dual-layer safety mirrors `symbolicSafetyNet`.** The bThread layer blocks `execute` events as defense-in-depth (even if the imperative check is somehow bypassed). The imperative layer provides feedback to the model via `gate_rejected` → synthetic tool result → conversation history. Without the imperative layer, the model would never know why its tool call was silently dropped.

2. **Constitution runs before custom gateCheck.** Constitution rules are fundamental safety constraints; custom checks are domain-specific. Short-circuiting on constitution rejection avoids running custom logic on already-blocked calls.

3. **OR logic for config fields.** Each field in `ConstitutionRuleConfig` represents a different dimension of restriction (`blockedTools`, `pathPattern`, `argPattern`). A rule like `{ blockedTools: ['bash'], pathPattern: '/etc/' }` means "block if it's a bash call OR if the path targets /etc/". For AND logic, write a custom `test` predicate.

4. **No runtime addition via public API.** Power users can call `bThreads.set()` directly with `createConstitution()` output. A convenience method on `AgentLoop` would require exposing `bThreads` — deferred until there's a clear use case.

### What's NOT in Wave 6

| Deferred | Reason |
|----------|--------|
| Runtime rule addition via `AgentLoop` API | `bThreads.set()` works directly for power users |
| JSON/TOML config file loading | Configs are programmatic objects; file loading is an integration concern |
| Constitution rule priorities / ordering | Rules are independent blocking threads; BP's blocking semantics handle composition |

---

## Wave 1: Tool Executor + Gate Check

**Branch:** `feat/ui-layer`
**Date:** 2026-02-22

### Context

The agent loop foundation (`src/agent/`) was complete — the 6-step BP cycle worked with mock `InferenceCall` and `ToolExecutor` seams. Wave 1 makes the agent capable of real work by filling in three seams: tool execution, gate evaluation, and multi-tool processing.

### What Shipped

#### 1. Tool Executor (`agent.tools.ts`)

`createToolExecutor({ workspace, tools? })` — factory returning a `ToolExecutor`:

| Built-in Tool | Implementation | Safety |
|---------------|---------------|--------|
| `read_file` | `Bun.file(resolved).text()` | Sandbox enforces workspace boundary |
| `write_file` | `Bun.write(resolved, content)` | Sandbox enforces workspace boundary |
| `list_files` | `new Bun.Glob(pattern).scan({ cwd })` | Pattern scoped to workspace cwd |
| `bash` | `Bun.spawn(['sh', '-c', cmd], { cwd })` | Sandbox enforces filesystem + network + process isolation |

- Custom tools merge over built-ins (override semantics)
- Unknown tools produce `failed` ToolResult (not exceptions)
- Each call is timed (duration in ms)
- `builtInToolSchemas` provides OpenAI-format tool definitions for the model

#### 2. Constitution (`agent.constitution.ts`)

**Thin constitution** — routing only, no containment logic. Filesystem, network, and process isolation is delegated to the deployment sandbox (srt, Landlock, Modal gVisor), which the genome generates per deployment target.

- **`classifyRisk(toolCall)`** — Returns `read_only` / `side_effects` / `high_ambiguity`. Determines the path through the agent loop (skip simulation, simulate, or simulate + neural score).
- **`createGateCheck({ customChecks? })`** — Composable factory returning a `GateCheck`. Custom checks are the extension point for domain-specific semantic rules. No `workspace` parameter — containment is the sandbox's job.

#### 3. Gate Wiring + Multi-Tool (`agent.ts`)

- `createAgentLoop` accepts optional `gateCheck` param (defaults to approve-all for backward compat)
- `proposed_action` handler now delegates to `gateCheck()` and routes to `gate_approved` / `gate_rejected`
- `gate_rejected` adds synthetic tool result to conversation history so the model sees the rejection
- Multi-tool: `pendingToolCalls` queue processes all tool calls from a single model response sequentially through the gate before re-invoking inference

#### 4. Types + Constants

- `ToolContext`, `ToolHandler`, `GateCheck` types in `agent.types.ts`
- `BUILT_IN_TOOLS` constant in `agent.constants.ts`

### File Inventory

| File | Action | Purpose |
|------|--------|---------|
| `src/agent/agent.tools.ts` | NEW | Tool executor factory + built-in tools + schemas |
| `src/agent/agent.constitution.ts` | NEW | Risk classification + gate routing |
| `src/agent/agent.types.ts` | MODIFIED | Added ToolContext, ToolHandler, GateCheck |
| `src/agent/agent.constants.ts` | MODIFIED | Added BUILT_IN_TOOLS |
| `src/agent/agent.ts` | MODIFIED | Gate wiring + multi-tool queue |
| `src/agent.ts` | MODIFIED | Re-exports for new modules |
| `src/agent/tests/agent.tools.spec.ts` | NEW | 14 tests (real temp directory) |
| `src/agent/tests/agent.constitution.spec.ts` | NEW | 13 tests (classification + gate routing) |
| `src/agent/tests/agent.spec.ts` | MODIFIED | 5 new integration tests (gate + multi-tool) |

### Verification

- **86 tests pass** across 4 files (51ms)
- **0 type errors** in `src/agent/`
- **0 lint errors** via biome

### Design Decisions

1. **Thin constitution — routing only, no containment.** The gate classifies risk level (determining the path through the agent loop) and runs domain-specific custom checks. Filesystem/network/process containment is delegated to the deployment sandbox. The genome generates the appropriate sandbox configuration per deployment target (srt for local, Landlock for Modal, bubblewrap for Firecracker). This keeps the framework surface area minimal and avoids duplicating what the OS already enforces.

2. **Pending queue with single-pop semantics for multi-tool.** Each tool call goes through the full gate -> execute -> result cycle individually, preserving the behavioral engine's event-by-event reasoning. The queue drains before re-invoking inference, so one model response with N tool calls = 1 inference call.

3. **Failed ToolResults, not exceptions, for unknown tools.** Keeps the agent loop stable and lets the model see the error in conversation history to self-correct.

4. **Tool handlers trust the sandbox.** Built-in tool handlers (`read_file`, `write_file`, `bash`) do not validate paths or commands. The deployment sandbox enforces workspace boundaries at the OS level. This avoids redundant userspace checks and keeps handlers simple.

### What's NOT in Wave 1

| Deferred | Reason |
|----------|--------|
| Constitution bThreads | Needs Simulate/Evaluate feedback channels (Wave 2) |
| Sandbox integration | Framework defines contract; genome generates sandbox config per deployment target |
| SQLite plan_steps | Memory layer (Wave 3) |
| Simulate (Dreamer) | Wave 2 |
| Evaluate (Judge) | Wave 2 |
| `search_files` tool | Can add later as another built-in |
