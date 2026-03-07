@AGENTS.md

## Testing

**Always use `bun test src/`** — never bare `bun test`. The `skills/` directory contains copied test assets with broken module paths that are not meant to be tested directly. The `package.json` `test` script scopes tests to `src/` only.

## Greenfield Mindset

This is **greenfield code with zero external consumers**. There are no backward-compatibility concerns. Don't preserve patterns or APIs "just in case." If something is unused, delete it. If a simpler approach exists, use it.

## BP-First Architecture Principles

These patterns apply to all BP-orchestrated code (`src/behavioral/`, `src/ui/`, and new server/agent code):

1. **Blocking prevents handler execution, not observability.** A blocked event won't fire its handler, but `useSnapshot` captures all BP engine decisions — selections, blocks, interrupts. The controller sends every snapshot to the server (`controller.ts:196-200`). The server sees everything. If you need a side effect for a blocked event (like a rejection message), the handler must check and produce it — don't rely on the block alone.

2. **Pipeline pass-through > conditional bypass.** Events should flow through the full pipeline. When a seam is absent, the handler passes through — don't short-circuit with conditionals.

3. **Thin handlers, structural coordination.** Handlers do ONE thing. Routing and lifecycle belong in bThreads.

4. **Additive composition.** Use unparameterized `behavioral()` — handlers self-validate with Zod at boundaries. Wire up what you need, ignore the rest.

5. **No backward compatibility for greenfield.** Always-full is simpler than configurable.

## Active Work Context

### Generative UI Node (feat/agent-loop-build branch)

Building top-down: UI → WebSocket server → agent loop. The full stack (agent + UI) is a Modnet node. Modules are generated for nodes.

**Key docs:**
- `docs/ARCHITECTURE.md` — top-level overview, first principles, pluggable models, deployment tiers
- `docs/AGENT-LOOP.md` — 6-step loop, selective simulation, ACP interface, default tools
- `docs/SAFETY.md` — three-axis risk model, defense in depth (6 layers)
- `docs/CONSTITUTION.md` — governance factories, neuro-symbolic split, MAC/DAC
- `docs/HYPERGRAPH-MEMORY.md` — git-versioned JSON-LD memory, context assembly, plans as bThreads
- `docs/TRAINING.md` — distillation pipeline, training tiers, flywheel
- `docs/PROJECT-ISOLATION.md` — multi-project orchestrator, IPC bridge, tool layers
- `docs/MODNET-IMPLEMENTATION.md` — modnet topology, A2A protocol, identity, access control, payment
- `docs/GENOME.md` — genome architecture for skills (seeds/tools/eval split, CONTRACT frontmatter, wave ordering)
- `docs/UI.md` — current `src/ui/` architecture (rendering, protocol, custom elements)
- `docs/WEBSOCKET-ARCHITECTURE.md` — open design questions for the WebSocket server layer
- `docs/Modnet.md` — Modnet design standards (MSS bridge-code tags, module structure)
- `docs/Structural-IA.md` — design grammar (objects, channels, levers, loops, modules, blocks)

**Reference code:** `src/reference/` contains 10 waves of agent loop implementation using behavioral programming. Use as a learning reference for BP coordination patterns, not as active code. **Do not read, modify, or run tests in `src/reference/`** — see `docs/AGENT-LOOP.md` for the authoritative loop design. Only read these files if explicitly asked to.

**What exists:**
- `src/behavioral/` — BP engine (`behavioral()`, `bThread`, `bSync`, `trigger`, `useFeedback`, `useSnapshot`)
- `src/ui/` — rendering pipeline, controller protocol, custom elements (see `docs/UI.md`)
- `src/server/` — thin I/O server node via `createServer()` (routes, WebSocket, pub/sub, hot reload). Auth routes (`/auth/register`, `/auth/verify`) return 501 stubs — WebAuthn implementation is next.
- `src/reference/` — agent loop reference (10 waves: tool executor, gate, simulate, evaluate, memory, orchestrator, constitution, BP-first, per-tool dispatch, AgentNode primitives)

**What's next:** WebAuthn auth (passkey registration/verification via SimpleWebAuthn) → then agent loop (`src/agent/`).

**Server architecture notes** (implemented in `src/server/server.ts`):
- Server has no BP of its own — it's a stateless connector between browser and agent BP
- Routes use `BunRequest` (has `req.cookies` with auto-apply); `fetch` fallback uses `Request` (needs `new Bun.CookieMap()`)
- WebSocket data typed via `data: {} as WebSocketData` pattern on websocket config
- Pub/sub topics: `sessionId` (document-level) and `sessionId:tagName` (island-level)
- `server.reload()` merges new routes with existing ones for hot-swap

**Module architecture** (decided, see `docs/MODNET-IMPLEMENTATION.md`):
- `node/` is a plain directory (not a git repo) — OS-level backup. Each module in `modules/` is its own git repo.
- Bun workspace: `package.json` at node root with `"workspaces": ["modules/*"]`, `workspace:*` for inter-module imports
- MSS bridge-code tags in `package.json` `"modnet"` field (`contentType`, `structure`, `mechanics`, `boundary`, `scale`)
- `@node` scope for agent identity
- No TypeScript compilation — Bun runs TS natively. Only `Bun.build({ target: 'browser' })` for `.behavior.ts` files sent via `update_behavioral`
- Code vs data split: `src/` never leaves node, `data/` can cross A2A gated by `boundary` tag
- Large assets symlinked from outside workspace (not git LFS) — requires constitution bThread for symlink integrity
- **Future migration:** If workspace grows too large, add `bunfig.toml` to switch `@node` scope to local npm registry (Verdaccio). No code changes — only resolution changes.

**Memory architecture** (decided, see `docs/HYPERGRAPH-MEMORY.md`):
- **Hypergraph memory** — BP decisions as git-versioned JSON-LD files, queryable via SPARQL-like patterns
- `useSnapshot` captures every BP decision (selections, blocks, interrupts) + every tool result
- Plans as bThreads with `plan_steps` materialized view for hot-path BP predicate queries
- Context assembly as BP event with contributor handlers
- Agent uses bash + git + grep for structural queries against its own workspace
- FTS5 indexes skill frontmatter and module manifests
- Log retention: hot JSON-LD → archived `.jsonl.gz` outside workspace → training extraction

**Constitution & governance** (decided, see `docs/CONSTITUTION.md`):
- Constitution rules are **governance factory functions** — same contract as `update_behavioral`: `(trigger) => { threads?, handlers? }`
- Branded with `$: '🏛️'` (GOVERNANCE_FACTORY_IDENTIFIER) — extends existing brand pattern (`🦄` template, `🪢` rules, `🎛️` controller, `🎨` decorator)
- **MAC** (mandatory) factories loaded at spawn, immutable. **DAC** (discretionary) factories loaded with user approval at runtime.
- Neuro-symbolic split: structural/syntactic checks in bThread block predicates (Gate, synchronous), contextual/semantic checks in async handlers feeding Simulate→Evaluate pipeline
- `protectGovernance` bThread queries sidecar db for MAC paths, blocks modifications

**Module sidecar** (decided, see `docs/MODNET-IMPLEMENTATION.md` § Package Sidecar):
- Per-module `.meta.db` (SQLite, committed to module's git repo) — indexes branded objects and string constants
- Node-level `.workspace.db` (rebuilt via ATTACH) — cross-module queries
- Collector tool (`collect_metadata`) scans source files for branded `$` identifiers, upserts sidecar
- Engine-agnostic query interface — SQLite initial, door open for columnar engines if analytical workloads emerge
- String constants in db (not hardcoded in templates) — eliminates injection vector, enables future encryption

## Open Questions

### Server + Agent Integration
How does server compose with agent? Is it just another tool seam?
```typescript
const agent = createAgentLoop({ inferenceCall, toolExecutor })
const server = createServer({ port: 3000, tls, allowedOrigins, trigger: agent.trigger, initialRoutes })
```
Also need to integrate https://simplewebauthn.dev/docs/

### Context Window Management (AGENT-LOOP.md)
Context assembly (`context_assembly` event + contributor handlers) is designed but no pruning strategy exists. Need to decide:
- Window budgeting: how to allocate context across contributors (plan state, history, tools, constraints, constitution)
- Pruning priority: what gets trimmed first when context exceeds model's limit
- Truncation vs summarization trade-off for older history
- Measurement: log which segments included/excluded per inference call (training signal)

### Model Lifecycle (ARCHITECTURE.md)
Pluggable Model interfaces exist but operational lifecycle is unspecified:
- Loading/unloading: how models initialize at agent spawn, how context window size is discovered
- Fallback chain: if primary model unavailable, what's the degradation path (e.g., API → local, frontier → reference)
- Model versioning: base version + fine-tuning epoch tracked in spawn config and session metadata
- Health monitoring: inference latency, tool call parse failures, thinking quality anomalies
- Hot-swap: can a running agent upgrade models mid-session?

### Mid-Task Steering (AGENT-LOOP.md)
BP has `interrupt` but UX for user intervention mid-task needs design:
- Intervention points: where in the 6-step loop can the user redirect? (gate rejection, simulation, evaluate)
- Override semantics: does user approval override a gate block? (capability × autonomy implications)
- Context injection: user feeds new info mid-task → how does it flow through context assembly?
- Teach mode: user corrections → GRPO preference pairs via `useSnapshot`

### Session Rollback & Branching (HYPERGRAPH-MEMORY.md)
Hypergraph + git provides the capability but user-facing UX is undesigned:
- Rollback semantics: "undo last N decisions" → revert to decision file D-N, reset BP state
- Which decisions are undoable? (side-effect reversibility varies)
- Branch creation: user explores alternative path at a decision point → git branch + parallel session
- Branch merging: compare results via hypergraph CLI, user selects preferred path

## Build Progress

### Completed
- [x] `src/behavioral/` — BP engine (1128 tests passing)
- [x] `src/ui/` — rendering pipeline, controller protocol, custom elements
- [x] `src/server/` — thin I/O server node via `createServer()`
- [x] `src/reference/` — 10-wave agent loop reference implementation
- [x] `src/tools/eval/` — eval harness (19K LOC, production-ready)
- [x] Doc breakout: SYSTEM-DESIGN-V3.md → 8 focused domain docs

### Next Up
- [ ] WebAuthn auth (passkey registration/verification via SimpleWebAuthn)
- [ ] `src/agent/` — agent loop implementation (from reference → production)
- [ ] Genome skills restructuring (seeds/tools/eval directories)
- [ ] Resolve open questions above as implementation reveals answers
