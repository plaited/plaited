@AGENTS.md

## Active Work Context

### Agent Framework Build (feat/agent-loop-build branch)

When working on `src/agent/` files, activate the **agent-build** skill — it contains the wave architecture, BP coordination patterns, event flow, and implementation context.

**Current status:**
- Wave 1 (tool executor, gate, multi-tool): Complete — 86 tests
- Wave 2 (simulate + evaluate): Complete — 140 tests
- BP exploration tests: Complete — 29 tests across 3 files in `src/behavioral/tests/`
- Task #13 (BP refactor): Complete — taskGate, per-task maxIterations, invoke_inference, done flag eliminated
- **Next: Wave 3 — Memory & Discovery** (SQLite persistence, FTS5 → LSP → semantic search pipeline, searchGate bThread)

**Key architectural patterns (post-refactor):**
- `taskGate` bThread: phase-transition thread blocks TASK_EVENTS between tasks (replaces done flag)
- Per-task `maxIterations`: added dynamically in task handler, `interrupt: [message]` frees thread name for reuse
- `invoke_inference` event: single async handler centralizes all inference calls (replaces 3 call sites)
- `onToolComplete()`: sync counter → triggers `invoke_inference` when 0 (replaces async checkComplete)

**243 total tests passing** (103 behavioral + 140 agent)
