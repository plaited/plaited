# Docs Audit: Conflicts & Open Work

## Implementation Status

| Layer | Docs Say | Code Reality |
|-------|----------|--------------|
| **BP Engine** (`src/behavioral/`) | Full algorithm, bThread, bSync | **100% implemented**, well-tested |
| **UI** (`src/ui/`) | Rendering pipeline, controller protocol, custom elements | **Complete**, actively maintained |
| **Server** (`src/server/`) | Stateless I/O connector, WebSocket, pub/sub | **Basic shell exists**, edge cases unhandled |
| **Agent Loop** (`src/agent/`) | 6-step pipeline, 12+ events, handler coordination | **Types + constants + memory handlers** — zero pipeline handler code |
| **Governance** | MAC/DAC factories, constitution bThreads | **Types only** — no `createGovernanceFactory` |
| **A2A Protocol** (`src/a2a/`) | HTTP+JSON, WebSocket, unix sockets, mTLS | **HTTP binding complete** — schemas, client, server, utils, tests. WebSocket/push notifications pending |
| **Project Isolation** | Orchestrator, subprocess spawning, IPC bridge | **Not implemented** |
| **Training Pipeline** | GradingDimensions, withMetaVerification, self-distillation | **Trial runner exists**, training semantics missing |
| **Hypergraph Memory** | JSON-LD vertices, @context vocab, attestation | **Partial** — core + EVENT_CAUSATION updates + commit vertex schema. BP integration missing |

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

## Recently Completed

### A2A Protocol (`feat/a2a-protocol` branch, merged)
- [x] **Layer 1 — Data Model:** Zod schemas for Parts, Messages, Tasks, Artifacts, Agent Card, Security Schemes, JSON-RPC envelopes (`a2a.schemas.ts`)
- [x] **Layer 2 — Operations:** `A2AOperationHandlers` (server) + `A2AClient` (client) type signatures (`a2a.types.ts`)
- [x] **Layer 3 — HTTP Binding:** `createA2AHandler` returns `{ routes }` for `Bun.serve()` composition. `createA2AClient` with unix socket + mTLS support (`a2a.server.ts`, `a2a.client.ts`)
- [x] **Utilities:** SSE encode/parse, JSON-RPC framing, Agent Card JWS signing/verification (ES256/ECDSA P-256) (`a2a.utils.ts`)
- [x] **Constants:** Task states, message roles, A2A methods, error codes, SSE headers, Agent Card path (`a2a.constants.ts`)
- [x] **Tests:** Schema validation, SSE round-trip, JSON-RPC framing, Agent Card signing, client-server integration with auth

### MCP Skill Restructuring (`refactor: restructure MCP client`)
- [x] **Two-tier architecture:** `add-mcp` (transport-agnostic core) → `add-remote-mcp` (HTTP convenience)
- [x] **Search skills updated:** `search-bun-docs`, `search-mcp-docs`, `search-agent-skills` import from `add-remote-mcp/scripts/remote-mcp.ts`
- [x] **Old `remote-mcp-integration` skill removed**, `remote-mcp-client.ts` removed from `src/tools/`

### Proactive Events & Memory Architecture
- [x] **Proactive event constants** (`agent.constants.ts`) — `tick`, `sensor_delta`, `sensor_sweep`, `sleep`, `snapshot_committed`
- [x] **Memory lifecycle events** (`agent.constants.ts`) — `commit_snapshot`, `consolidate`, `defrag`
- [x] **`SIDE_EFFECT_TOOLS` set** — identifies write_file, edit_file, bash as commit triggers
- [x] **Memory handler types** (`agent.types.ts`) — detail types for memory lifecycle events

### Hypergraph Tool Updates
- [x] **`EVENT_CAUSATION` map updated** (`hypergraph.utils.ts`) — added `tick → sensor_delta → context_assembly`, `sleep` (terminal), `snapshot_committed` (terminal)
- [x] **`SessionMetaSchema` updated** (`hypergraph.schemas.ts`) — added `commits` field
- [x] **Commit vertex fixture** added for testing
- [x] **`validate-thread`** (`src/tools/validate-thread.ts`) — 7-check validation gate (parse, brand, sandbox, purity, MAC protection, name collision, tests pass)
- [x] **`ingest-goal`** (`src/tools/ingest-goal.ts`) — Goal `.ts` factory → JSON-LD vertex
- [x] **`memory-handlers`** (`src/agent/memory-handlers.ts`) — `commit_snapshot`, `consolidate`, `defrag` handlers
- [x] **`skill-discovery`** (`src/tools/skill-discovery.ts`) — discover skills from directories
- [x] **`skill.utils.ts`** extracted — shared skill utilities

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
- [x] **`validateAndImport` loader** — `validate-thread.ts` implements 7-check validation gate.
- [ ] **`.memory/goals/` directory** — Goal factories persisted as TypeScript. Loaded at spawn via `loadPersistedThreads`. Git-versioned.
- [ ] **Trial/grader for bThread generation** — Prompt cases for goal and DAC generation. Grader runs tsc + bun test. pass@k/pass^k measures generation reliability. Feeds distillation pipeline.

**Design decision:** Generated TypeScript over declarative JSON-LD. Rationale:
- 5-layer verification stack (tsc, LSP, tests, trial/grader, BP runtime) is stronger than schema validation alone
- Full BP expressiveness — any bThread pattern, not limited by a predicate DSL
- Verification IS the training signal — pass/fail on generated threads feeds the distillation flywheel
- Same pattern the agent already uses for MSS module code generation
- All categories (MAC, DAC, goals, workflows) share the same factory contract — only brand and approval flow differ
- See CONSTITUTION.md § Generated bThreads for full architecture

### High — hypergraph tool updates (complete)

Three layers — agent tools go through pipeline, memory handlers don't, CLI tools run offline:

| Layer | Uses | Goes through pipeline? | Example |
|-------|------|----------------------|---------|
| Agent tools (CRUD) | Tool handlers in registry | Yes — gate, simulate, evaluate | `write_file`, `bash`, `search` |
| Memory handlers | `Bun.write`, `Bun.file`, `Bun.$` directly | No — BP coordinates via bThreads | `commit_snapshot`, `consolidate`, `defrag` |
| Ingestion CLI | `Bun.file`, `Bun.write`, LSP | No — offline pipeline | `ingest-skill`, `ingest-rules`, `ingest-goal` |
| Validation CLI | `tsc`, `bun test`, LSP | No — pre-load gate | `validate-thread` |

**Updates to existing code:**
- [x] **`EVENT_CAUSATION` map** (`hypergraph.utils.ts`) — Added proactive and memory lifecycle events
- [x] **`SessionMetaSchema`** (`hypergraph.schemas.ts`) — Added `commits` field
- [x] **`buildSessionSummary()`** (`hypergraph.utils.ts`) — Collects commit vertex `@id`s from session docs
- [x] **Proactive event constants** (`agent.constants.ts`) — All proactive and memory events added

**Memory handlers (implemented):**
- [x] **`commit_snapshot` handler** — `git add` + `git commit` + SHA capture + commit vertex
- [x] **`consolidate` handler** — Decisions → `decisions.jsonl`, `meta.jsonld`, embedding, final commit
- [x] **`defrag` handler** — `git archive` old sessions, clean working tree

**CLI tools (complete):**
- [x] **`plaited ingest-goal`** — Goal `.ts` factory → JSON-LD vertex
- [x] **`plaited validate-thread`** — 7-check validation gate
- [x] **`plaited ingest-skill`** — SKILL.md + TS → `skills/{name}.jsonld`
- [x] **`plaited ingest-rules`** — AGENTS.md → `rules/{scope}.jsonld`

### Medium — enables multi-agent & training

- [x] **A2A protocol** (`src/a2a/`) — HTTP binding complete. Known-peers, push notifications, WebSocket binding remaining.
- [ ] **Known-peers management** — Trust store, TOFU lifecycle, peer revocation. Connects Agent Card signing (exists) to trust decisions.
- [ ] **Project isolation orchestrator** — Multi-project coordination, IPC bridge, tool layers. Nothing built.
- [ ] **Training pipeline semantics** — `GradingDimensions`, `withMetaVerification`, augmented self-distillation. Trial runner exists but scoring/training loop doesn't.
- [ ] **Hypergraph <-> BP integration** — Bridge between BP snapshots and JSON-LD file persistence. Both sides partially exist but aren't connected.

### Medium — enables proactive agent (decided: Variant A)

- [x] **Proactive event constants** — `tick`, `sensor_delta`, `sensor_sweep`, `sleep`, `snapshot_committed` added to `agent.constants.ts`
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

### Medium — enterprise network topology (design complete, see MODNET-IMPLEMENTATION.md)

- [ ] **PM/orchestrator node pattern** — Admin's sovereign agent managing infrastructure nodes via A2A. Design documented. Depends on agent loop.
- [ ] **Node generation via seeds** — Ephemeral seed skills generate nodes, then are discarded. Node identity is structural (constitution + modules + Agent Card).
- [ ] **Enterprise genome** — One-shot bootstrap document generates PM node. PM carries seed templates to generate the rest of the network.
- [ ] **Modnet metadata conventions** — `modnet:role`, `modnet:constitutionHash` in Agent Card `metadata` field.

### Low — nice-to-have

- [ ] **WebSocket edge cases** — SSR reconciliation, MPA view transitions, origin validation per WEBSOCKET-ARCHITECTURE.md
- [ ] **Session rollback/branching UX** — HYPERGRAPH-MEMORY.md describes capability; no user-facing design
- [ ] **Mid-task steering** — User intervention points during the 6-step loop
- [ ] **A2A WebSocket binding** — Persistent bidirectional. Optimization for sustained collaboration; HTTP covers all operations.
- [ ] **A2A push notification handlers** — `tasks/pushNotificationConfig/*`. Constants exist, no handler code.

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
