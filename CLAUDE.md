@AGENTS.md

## Active Work Context

### Agent Framework Build (feat/agent-loop-build branch)

When working on `src/agent/` files, activate the **agent-build** skill — it contains the wave architecture, BP coordination patterns, event flow, and implementation context.

**Current status — all 6 waves complete:**
- Wave 1 (tool executor, gate, multi-tool): Complete
- Wave 2–3 (simulate, evaluate, memory, search): Complete
- Wave 4 (event log persistence + context injection): Complete
- Wave 5 (orchestrator, multi-project coordination): Complete
- Wave 6 (constitution as bThreads, dual-layer safety): Complete

**322 total tests passing** (219 agent + 103 behavioral) across 25 files.

**Outstanding issues** (see `docs/WAVE-LOG.md` for details):
- Stale TSDoc in `agent.schemas.ts` (3 comments reference "later" for completed work)
- Orchestrator IPC handler replacement is fragile (`agent.orchestrator.ts` `getOrSpawnProcess()`)
- LSP semantic search pipeline + `searchGate` bThread never built (Wave 3 partial)
- Eval harness not yet importing canonical schemas from `plaited/agent`
- Some exported functions lack dedicated unit tests (covered by integration)

**Key architectural patterns:**
- `taskGate` bThread: phase-transition thread blocks TASK_EVENTS between tasks
- Per-task `maxIterations`: added dynamically in task handler, `interrupt: [message]` frees thread name for reuse
- `invoke_inference` event: single async handler centralizes all inference calls
- `onToolComplete()`: sync counter → triggers `invoke_inference` when 0
- `constitution_*` bThreads: additive blocking rules with dual-layer safety (bThread + imperative gateCheck)
