# Agent Implementation — Wave Log

Incremental implementation log for the Plaited agent layer. Each wave is a self-contained increment that leaves all tests green.

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
