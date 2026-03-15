# Docs Audit: Conflicts & Open Work

## Implementation Status

| Layer | Docs Say | Code Reality |
|-------|----------|--------------|
| **BP Engine** (`src/behavioral/`) | Full algorithm, bThread, bSync | **100% implemented**, well-tested |
| **UI** (`src/ui/`) | Rendering pipeline, controller protocol, custom elements | **Complete**, actively maintained |
| **Server** (`src/server/`) | Stateless I/O connector, WebSocket, pub/sub | **Basic shell exists**, edge cases unhandled |
| **Agent Loop** (`src/agent/`) | 6-step pipeline, 12+ events, handler coordination | **Complete** — `createAgentLoop()` wires all handlers. Governance, gate, simulate, evaluate, context assembly, snapshot writer, memory handlers all implemented. |
| **Governance** | MAC/DAC factories, constitution bThreads | **Complete** — unified branded factories (`🏛️`/`🎯`/`🔄`), default MAC rules, goal persistence |
| **A2A Protocol** (`src/a2a/`) | HTTP+JSON, WebSocket, unix sockets, mTLS | **Complete** — HTTP + WebSocket bindings, push notification CRUD + webhooks, known-peers TOFU trust store |
| **Project Isolation** | Orchestrator, subprocess spawning, IPC bridge | **Not implemented** |
| **Training Pipeline** | GradingDimensions, withMetaVerification, self-distillation | **Complete** — scoring schemas, withStatisticalVerification, bThread grader + trial infrastructure |
| **Hypergraph Memory** | JSON-LD vertices, @context vocab, attestation | **Complete** — snapshot-writer bridges BP→JSON-LD, all ingestion CLI tools, EVENT_CAUSATION, session summaries |

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

### 3. Genome restructuring vs. current skills layout
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

### Critical — blocks everything downstream (COMPLETE)

- [x] **`createAgentLoop()`** — 6-step pipeline implemented in `agent.loop.ts`. Wires all handlers, bThreads, and memory into a single `behavioral()` instance. Returns `AgentNode` interface.
- [x] **Context assembly system** — `agent.context.ts`: priority-based contributors, budget trimming, built-in contributors (system prompt, history, tools, plan, rejections).
- [x] **Gate handler with risk tag routing** — `agent.gate.ts`: `composedGateCheck` routes by risk tags (workspace → execute, other → simulate, constitution predicate → rejected).

### High — enables the safety model (COMPLETE)

- [x] **Governance factories** — `agent.governance.ts` refactored to use unified `createConstitution` from `agent.factories.ts`. Default MAC: noRmRf, noEtcWrites, noForcePush, protectGovernance. Predicate helpers exported for gate-level checks.
- [x] **Simulation handler** (Dreamer) — `agent.simulate.ts`: State Transition Prompt, `Model.reason()` prediction, structured parsing.
- [x] **Evaluation handler** (Judge) — `agent.evaluate.ts`: 5a symbolic gate (regex/keyword), 5b neural scorer (Model-based), combined pipeline with short-circuit.

### High — enables bThread generation (mostly complete)

- [x] **Branded factory contract** — `agent.factories.ts`: unified `{ $, create }` shape. Three brands: `🏛️` (constitution), `🎯` (goal), `🔄` (workflow).
- [ ] **Test-first generation flow** — Agent generates `.spec.ts` first (red), then `.ts` implementation (green). Types defined in `agent.generation.ts`.
- [x] **`validateAndImport` loader** — `validate-thread.ts` implements 7-check validation gate.
- [x] **`.memory/goals/` directory** — `agent.goals.ts`: `loadPersistedGoals`, `saveGoal`, `removeGoal` with MAC protection checks.
- [x] **Trial/grader for bThread generation** — `bthread-grader.ts` + `bthread-trial.ts`: weighted scoring, prompt cases in fixtures, pass@k integration.

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

- [x] **A2A protocol** (`src/a2a/`) — HTTP + WebSocket bindings complete. Push notification CRUD + webhook delivery. Known-peers with TOFU lifecycle.
- [x] **Known-peers management** — `a2a.peers.ts`: PeerStore (JSON-backed), TOFU verification, trust levels (tofu/verified/blocked), key change detection.
- [ ] **Project isolation orchestrator** — Multi-project coordination, IPC bridge, tool layers. Nothing built.
- [x] **Training pipeline semantics** — `training.schemas.ts` + `training.ts`: GradingDimensions, `withStatisticalVerification` (renamed from `withMetaVerification`), `computeTrainingWeight`, DecisionStep schema.
- [x] **Hypergraph <-> BP integration** — `snapshot-writer.ts`: `createSnapshotWriter` converts BP snapshots to JSON-LD decision documents, calls `trackDecision` for commit bundling.

### Medium — enables proactive agent (decided: Variant A)

- [x] **Proactive event constants** — All proactive events in `agent.constants.ts`
- [x] **Heartbeat bThread** — `proactive.ts`: `createHeartbeat` with configurable interval, fires `tick` events via `trigger()`.
- [x] **Sensor sweep system** — `proactive.ts`: `createSensorBatchThread` coordinates parallel sensors, emits `sensor_delta` or `sleep`.
- [ ] **User-configurable interval** — `set_heartbeat` tool call. Natural language control. The bThread exists; the tool definition does not.
- [ ] **Push notification routing** — `message` handler routes proactive results. Extends existing `render` protocol.
- [x] **`tickYield` bThread** — `proactive.ts`: `createTickYieldThread` ensures user tasks interrupt proactive cycles.

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

- [x] **WebSocket edge cases** — Replay buffer with TTL, reconnection detection, close codes, CSP headers.
- [ ] **Session rollback/branching UX** — HYPERGRAPH-MEMORY.md describes capability; no user-facing design
- [ ] **Mid-task steering** — User intervention points during the 6-step loop
- [x] **A2A WebSocket binding** — `a2a.ws-server.ts` + `a2a.ws-client.ts`. Feature parity with HTTP binding. Stream completion sentinel.
- [x] **A2A push notification handlers** — `tasks/pushNotificationConfig/*` CRUD + `sendPushNotification` webhook delivery.

## Accurate Documents (no action needed)

- ~~**BEHAVIORAL-PROGRAMMING.md**~~ — Migrated to `skills/behavioral-core/references/algorithm-reference.md`
- **UI.md** — Accurately describes `src/ui/`. Recently updated.
- **Structural-IA.md** — Design grammar doc, not implementation-dependent.
- **Modnet.md** — MSS design standards, conceptual.

## Documents Most at Risk of Drift

1. **AGENT-LOOP.md** — Slimmed to overview. Implementation patterns moved to `skills/agent-loop/`.
2. **CONSTITUTION.md** — References systems that don't exist. Will drift as governance is implemented.

## Recommendations

1. Add implementation status badges to each doc (`[DESIGN ONLY]`, `[PARTIAL]`, `[IMPLEMENTED]`)
2. Update docs alongside code in the same commit — not speculatively
3. GENOME.md restructuring should wait until agent loop works
