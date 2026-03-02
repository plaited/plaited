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
- `docs/UI.md` — current `src/ui/` architecture (rendering, protocol, custom elements)
- `docs/WEBSOCKET-ARCHITECTURE.md` — open design questions for the WebSocket server layer
- `docs/Modnet.md` — Modnet design standards (MSS bridge-code tags, module structure)
- `docs/Structural-IA.md` — design grammar (objects, channels, levers, loops, modules, blocks)

**Reference code:** `src/reference/` contains 10 waves of agent loop implementation using behavioral programming. Use as a learning reference for BP coordination patterns, not as active code. **Do not read, modify, or run tests in `src/reference/`** — the agent-build skill already documents the patterns. Only read these files if explicitly asked to.

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

**Module architecture** (decided, see `docs/SYSTEM-DESIGN-V3.md` § Module Architecture):
- `node/` is a plain directory (not a git repo) — OS-level backup. Each module in `modules/` is its own git repo.
- Bun workspace: `package.json` at node root with `"workspaces": ["modules/*"]`, `workspace:*` for inter-module imports
- MSS bridge-code tags in `package.json` `"modnet"` field (`contentType`, `structure`, `mechanics`, `boundary`, `scale`)
- `@node` scope for agent identity
- No TypeScript compilation — Bun runs TS natively. Only `Bun.build({ target: 'browser' })` for `.behavior.ts` files sent via `update_behavioral`
- Code vs data split: `src/` never leaves node, `data/` can cross A2A gated by `boundary` tag
- Large assets symlinked from outside workspace (not git LFS) — requires constitution bThread for symlink integrity
- **Future migration:** If workspace grows too large, add `bunfig.toml` to switch `@node` scope to local npm registry (Verdaccio). No code changes — only resolution changes.

**Memory architecture** (decided, see `docs/SYSTEM-DESIGN-V3.md` § Memory Architecture):
- **Event log IS the memory** — no separate memory files, no semantic cache, no relation store
- SQLite event log via `useSnapshot` captures every BP decision (selections, blocks, interrupts) + every tool result
- Only materialized view: `plan_steps` table (hot-path BP predicate queries for step dependencies)
- Agent uses bash + git + grep for structural queries against its own workspace — no specialized discovery layer
- FTS5 indexes skill frontmatter and module manifests (populated from event log entries)
- Log retention: hot SQLite → archived `.jsonl.gz` outside workspace → training extraction
- LSP code graph and semantic search deferred — FTS5 + bash covers 80% case

**Constitution & governance** (decided, see `docs/SYSTEM-DESIGN-V3.md` § Constitution):
- Constitution rules are **governance factory functions** — same contract as `update_behavioral`: `(trigger) => { threads?, handlers? }`
- Branded with `$: '🏛️'` (GOVERNANCE_FACTORY_IDENTIFIER) — extends existing brand pattern (`🦄` template, `🪢` rules, `🎛️` controller, `🎨` decorator)
- **MAC** (mandatory) factories loaded at spawn, immutable. **DAC** (discretionary) factories loaded with user approval at runtime.
- Neuro-symbolic split: structural/syntactic checks in bThread block predicates (Gate, synchronous), contextual/semantic checks in async handlers feeding Simulate→Evaluate pipeline
- `protectGovernance` bThread queries sidecar db for MAC paths, blocks modifications

**Module sidecar** (decided, see `docs/SYSTEM-DESIGN-V3.md` § Package Sidecar):
- Per-module `.meta.db` (SQLite, committed to module's git repo) — indexes branded objects and string constants
- Node-level `.workspace.db` (rebuilt via ATTACH) — cross-module queries
- Collector tool (`collect_metadata`) scans source files for branded `$` identifiers, upserts sidecar
- Engine-agnostic query interface — SQLite initial, door open for columnar engines if analytical workloads emerge
- String constants in db (not hardcoded in templates) — eliminates injection vector, enables future encryption

## TODO
Modify Server this code is pretty slim so the question is it just another tools?
const agent = createAgentLoop({ inferenceCall, toolExecutor })
const server = createServer({ port: 3000, tls, allowedOrigins, trigger: agent.trigger, initalRoutes })
Also we  need to integrate https://simplewebauthn.dev/docs/
