# Docs Audit: Conflicts & Open Work

## Implementation Status

| Layer | Docs Say | Code Reality |
|-------|----------|--------------|
| **BP Engine** (`src/behavioral/`) | Full algorithm, bThread, bSync | **100% implemented**, well-tested |
| **UI** (`src/ui/`) | Rendering pipeline, controller protocol, custom elements | **Complete**, actively maintained |
| **Server** (`src/server/`) | Stateless I/O connector, WebSocket, pub/sub | **Basic shell exists**, edge cases unhandled |
| **Agent Loop** (`src/agent/`) | 6-step pipeline, 12+ events, handler coordination | **Types only** — zero handler code |
| **Governance** | MAC/DAC factories, constitution bThreads | **Types only** — no `createGovernanceFactory` |
| **A2A Protocol** (`src/a2a/`) | HTTP+JSON, WebSocket, unix sockets, mTLS | **Directory doesn't exist** |
| **Project Isolation** | Orchestrator, subprocess spawning, IPC bridge | **Not implemented** |
| **Training Pipeline** | GradingDimensions, withMetaVerification, self-distillation | **Trial runner exists**, training semantics missing |
| **Hypergraph Memory** | JSON-LD vertices, @context vocab, attestation | **Partial** — core exists, BP integration missing |

## Cross-Document Conflicts

### 1. "Context Assembly" — three docs, zero code
- **SAFETY.md** calls it Layer 0 (soft pre-filter)
- **AGENT-LOOP.md** calls it Step 1 (Context)
- **HYPERGRAPH-MEMORY.md** says it becomes "observable, trainable, composable"
- **Reality:** Event constant exists in `agent.constants.ts`. No handler, no contributor system, no budget allocation.

### 2. Risk tag routing — described, not enforced
- **SAFETY.md** claims "default-deny: unknown/untagged tools route to Simulate+Judge"
- **AGENT-LOOP.md** describes `gate_approved` routing (workspace -> execute, others -> simulate)
- **Reality:** Risk tag enum exists. No routing logic applies them.

### 3. Attestation layer — two docs, different scopes
- **CRITIQUE-RESPONSE.md** defines 6 evidence types as a new hypergraph vertex layer
- **GAP-ANALYSIS.md** calls it "evidence-backed meta-verification" positioned post-execution
- Overlapping but different scopes. Neither is implemented.

### 4. CRITIQUE-RESPONSE.md claims gaps are "resolved" — they aren't
- GAP-ANALYSIS.md identifies 7 gaps. CRITIQUE-RESPONSE.md marks Gaps 2, 4, 5, 7 as "EXISTING DESIGN."
- The designs exist; the code doesn't.

### 5. Genome restructuring vs. current skills layout
- **GENOME.md** proposes `seeds/`, `tools/`, `eval/` with CONTRACT frontmatter and wave ordering
- **Current reality:** Flat `skills/` directory with SKILL.md per AgentSkills spec
- No conflict — GENOME.md is a future refactor plan — but nothing links the two conventions.

## Priority Work Items

### Critical — blocks everything downstream

- [ ] **`createAgentLoop()`** — 6-step pipeline (Context -> Reason -> Gate -> Simulate -> Evaluate -> Execute). Zero implementation. Every other feature depends on this.
- [ ] **Context assembly system** — No contributor handlers, no budget allocation, no pruning strategy. CLAUDE.md lists context window management as open question.
- [ ] **Gate handler with risk tag routing** — Risk tags exist as constants but nothing reads or routes on them.

### High — enables the safety model

- [ ] **Governance factories** — No `createGovernanceFactory`, no MAC/DAC loading, no `protectGovernance` bThread. CONSTITUTION.md is design-only.
- [ ] **Simulation handler** (Dreamer/State Transition Prompt) — Layer 4 of defense. No implementation.
- [ ] **Evaluation handler** (symbolic gate + neural scorer) — Layer 5. No implementation.

### High — enables bThread generation (decided: generated TypeScript with test-first verification)

- [ ] **Branded factory contract** — Extend GovernanceFactory pattern with `🎯` (goal) and `🔄` (workflow) brands alongside `🏛️` (constitution). Same `{ threads?, handlers? }` return shape.
- [ ] **Test-first generation flow** — Agent generates `.spec.ts` first (red), then `.ts` implementation (green). Verification pipeline: tsc → LSP analysis → bun test → load.
- [ ] **`validateAndImport` loader** — Parse, brand check, sandbox check (no imports outside behavioral types), purity check (no side effects), MAC protection (goals can't block MAC events), name collision check, test pass check.
- [ ] **`.memory/goals/` directory** — Goal factories persisted as TypeScript. Loaded at spawn via `loadPersistedThreads`. Git-versioned.
- [ ] **Trial/grader for bThread generation** — Prompt cases for goal and DAC generation. Grader runs tsc + bun test. pass@k/pass^k measures generation reliability. Feeds distillation pipeline.

**Design decision:** Generated TypeScript over declarative JSON-LD. Rationale:
- 5-layer verification stack (tsc, LSP, tests, trial/grader, BP runtime) is stronger than schema validation alone
- Full BP expressiveness — any bThread pattern, not limited by a predicate DSL
- Verification IS the training signal — pass/fail on generated threads feeds the distillation flywheel
- Same pattern the agent already uses for MSS module code generation
- All categories (MAC, DAC, goals, workflows) share the same factory contract — only brand and approval flow differ
- See CONSTITUTION.md § Generated bThreads for full architecture

### Medium — enables multi-agent & training

- [ ] **A2A protocol** (`src/a2a/`) — Required for modnet topology. Directory doesn't exist.
- [ ] **Project isolation orchestrator** — Multi-project coordination, IPC bridge, tool layers. Nothing built.
- [ ] **Training pipeline semantics** — `GradingDimensions`, `withMetaVerification`, augmented self-distillation. Trial runner exists but scoring/training loop doesn't.
- [ ] **Hypergraph <-> BP integration** — Bridge between BP snapshots and JSON-LD file persistence. Both sides partially exist but aren't connected.
- [ ] **Commit vertex + SHA capture** — `commit_snapshot` handler: run `git commit`, capture SHA via `git rev-parse HEAD`, write commit vertex `.jsonld` with `attestsTo` links to bundled decisions. One-behind pattern (vertex for commit N stored in commit N+1). See HYPERGRAPH-MEMORY.md § Commit Vertex.
- [ ] **Generated factory ingestion** — When agent generates `.memory/goals/*.ts` or `.memory/constitution/dac/*.ts`, also emit design-time `.jsonld` vertex in `.memory/threads/` for hypergraph queryability. Re-ingest on `git diff`.

### Medium — enables proactive agent (decided: Variant A)

- [ ] **Heartbeat bThread** — `tick` event as second entry point into the 6-step pipeline. Timer fires `trigger({ type: 'tick' })`, `taskGate` extended to accept both `task` and `tick`. See AGENT-LOOP.md § Proactive Mode.
- [ ] **Sensor sweep system** — `useFeedback` handlers on `tick`, parallel sensor execution, `sensor_delta` events, `sensorBatch` bThread coordination. No-delta → `sleep` (skip inference).
- [ ] **User-configurable interval** — `set_heartbeat` tool call. Natural language control ("check every 2 hours", "pause heartbeat"). Zero marginal cost on local hardware; cloud cost scales with interval.
- [ ] **Push notification routing** — `message` handler routes proactive results to WebSocket (connected) or external channel (disconnected). Extends existing `render` protocol.
- [ ] **`tickYield` bThread** — User prompts interrupt in-progress proactive cycles. User always wins priority.

**Design decision:** Variant A (Heartbeat as bThread) chosen over Sentinel Process (B) and Dual-Mode Engine (C). Rationale:
- Zero marginal cost on local hardware (Mac Mini/Studio/DGX Spark) — GPU is sunk cost, proactive fills idle cycles
- Fully composable with existing BP patterns (constitution blocks ticks, `maxIterations` counts autonomous actions)
- Complete training signal — every tick, sensor read, and SLEEP decision appears in `useSnapshot`
- Simplest to implement — uses `repeat: true`, `trigger`, `useFeedback` (all production primitives)
- Can evolve toward Variant C (Dual-Mode) later by adding sensor abstractions
- Variant B only preferred for cloud-only/serverless deployment (not our primary target)

### Low — nice-to-have

- [ ] **WebSocket edge cases** — SSR reconciliation, MPA view transitions, origin validation per WEBSOCKET-ARCHITECTURE.md
- [ ] **Session rollback/branching UX** — HYPERGRAPH-MEMORY.md describes capability; no user-facing design
- [ ] **Mid-task steering** — User intervention points during the 6-step loop

## Accurate Documents (no action needed)

- **BEHAVIORAL-PROGRAMMING.md** — Perfect match to `src/behavioral/`
- **UI.md** — Accurately describes `src/ui/`. Recently updated.
- **Structural-IA.md** — Design grammar doc, not implementation-dependent.
- **Modnet.md** — MSS design standards, conceptual.

## Documents Most at Risk of Drift

1. **AGENT-LOOP.md** — Most detailed, most aspirational. Will need constant updates as `createAgentLoop()` is built.
2. **CONSTITUTION.md** — References systems that don't exist. Will drift as governance is implemented.
3. **CRITIQUE-RESPONSE.md** — Claims resolutions that aren't coded. Could mislead.

## Recommendations

1. Add implementation status badges to each doc (`[DESIGN ONLY]`, `[PARTIAL]`, `[IMPLEMENTED]`)
2. Update docs alongside code in the same commit — not speculatively
3. CRITIQUE-RESPONSE.md should distinguish "design exists" from "code exists"
4. GENOME.md restructuring should wait until agent loop works
