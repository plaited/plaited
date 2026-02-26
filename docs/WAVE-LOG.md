# Agent Implementation — Wave Log

Incremental implementation log for the Plaited agent layer. Each wave is a self-contained increment that leaves all tests green.

**Current total: 345 tests passing** (242 agent + 103 behavioral) across 27 files.

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
