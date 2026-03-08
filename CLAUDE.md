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
- `docs/SAFETY.md` — composable risk tags, defense in depth (6 layers)
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
- Node root IS a git repo (`.gitignore` excludes `modules/`). Each module in `modules/` has its own `git init`. OS-level backups capture `.git` folders. Eliminates "local but not git-tracked" — everything in the workspace is versioned.
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

## Decided (from pi-mono audit)

### Model Interface (ARCHITECTURE.md)
- `Model.reason()` returns `AsyncIterable<ModelDelta>` (not `Promise`), accepts `signal: AbortSignal`
- `ModelDelta` includes `thinking_delta`, `text_delta`, `toolcall_delta`, `done`, `error`
- `ModelResponse` (final) includes `usage: { inputTokens, outputTokens }` for context budgeting
- Inference handler consumes the stream privately, triggers BP events per chunk for progressive UI
- OpenAI-compatible API is the wire format — llama.cpp, vLLM, Ollama all support it

### Three Model Roles (ARCHITECTURE.md)
Three interfaces at the same level — infrastructure called by handlers, NOT tool calls:
- **Model** (required) — `reason(context, signal) → AsyncIterable<ModelDelta>` — reasoning + tool calls
- **Indexer** (deferred, optional) — `embed(text) → Float32Array` — text → embeddings for semantic search
- **Vision** (deferred, optional) — `analyze(image, prompt) → VisionResponse` — image → structured description

Reference stack: Model (Falcon-H1R 7B, ~14GB) + Indexer (EmbeddingGemma 300M, ~600MB) + Vision (Qwen2.5-VL-7B, ~14GB) = ~29GB fp16 on DGX Spark (128GB). Skills extend Vision for specialized use cases (visual agent, chart analysis).

Indexer/Vision are NOT tool calls because: (1) they're perception (input processing), not action (output); (2) no side effects → no safety gating needed; (3) handlers call them to enrich context, the Model never calls them directly. BP coordinates their lifecycle (bThreads can block inference until processing completes) but not their execution.

### Prompt Caching — Session-Level System Prompt Pinning
Each pub/sub topic (document-level `sessionId`, island-level `sessionId:tagName`) is a session. The system prompt (constitution, tool descriptions, personality) is pinned at session start and stays immutable across turns. The inference server's KV-cache naturally caches this prefix. No application-level cache logic. Dynamic content (plan state, history, last message) goes after the stable prefix.

### Context Overflow — Hybrid Budget + Fallback
Pre-flight token budget check in context assembly (count tokens, prune if over limit: history first → inactive tool descriptions → plan detail). If tokenizer mismatch causes unexpected overflow, reactive retry (controller.ts pattern: error → reduce budget → re-assemble → retry). Flywheel: snapshot logs reveal recurring overflow patterns → crystallize into MAC bThreads that proactively shape context assembly → owner approves.

### Inference Retry — Controller-Mirror bThread Pattern
Direct port of `controller.ts` WebSocket retry (exponential backoff, max retries). Handler for `inference_error` checks retry count, applies backoff via `setTimeout`, triggers `invoke_inference` retry. Error-type routing: transient errors (429, 5xx, OOM) → retry; context overflow → re-assemble with reduced budget; permanent errors (auth, model not found) → surface to user.

### Request Abort — BP Interrupt + AbortSignal
Already handled: `user_action` (UI) or `message` (ACP) → BP `interrupt` kills inference bThread → `AbortSignal` propagates to `fetch()` (inference) and `Bun.spawn()` (tool subprocess). Same pattern as `sim_guard_{id}` per-call threads.

### Tool Progress — useSnapshot Observability
Already handled: `useSnapshot` captures every BP decision including `execute` and `tool_result` events. Long-running tools can trigger intermediate `tool_progress` events → handlers send `render` messages for progressive UI. All observable and trainable.

### Streaming UI — BP Events (not separate protocol)
Inference handler reads OpenAI SSE stream → triggers BP events (`thinking_delta`, `text_delta`) → handlers send `render` messages to generative UI and ACP clients. BP IS the streaming protocol. No separate 12-event system needed.

### External Tool Integration — Composable Wrappers
External capabilities (MCP servers, REST APIs, CLIs, A2A agents, databases) are integrated via a uniform pattern:
1. **Discover** — one-shot script fetches schema (MCP `tools/list`, OpenAPI spec, `--help`, A2A agent card, DB introspection)
2. **Store** — schema saved as JSON-LD in hypergraph memory. Available during context assembly so agent knows what tools exist.
3. **Generate** — typed TypeScript wrapper module with async functions per tool. Handles client lifecycle (connect, invoke, disconnect) internally.
4. **Skill** — teaches the agent how to compose multi-step scripts using the wrapper module.
5. **Compose** — agent writes ad-hoc scripts that import wrapper functions, chain operations with control flow, filter/transform data in code. Only results reach model context.

**PII + training boundary:** Real data can flow freely to the local model — it's on-device, useful for simulation/Dreamer prediction, and never leaves the node. The boundary matters for **training data extraction**: when trajectories are exported for distillation (see TRAINING.md), wrapper modules produce synthetic variants with matching schema + statistical distribution so sensitive data never reaches external training infrastructure. The wrapper is the sanitization point, not the model context.

**A2A boundary alignment:** Wrapper modules are `src/` (never shared). Schemas are `data/` (shared via A2A for capability advertisement). When agents ask "what tools do you have?", the answer is stored schemas — not wrapper code. Execution stays in the owning agent's boundary.

**Meta-skill:** `tool-integration` teaches the agent how to run discovery for any source type and generate wrapper + skill. It's the skill that creates other skills.

**Gate:** All external calls go through bash → gate bThread classifies risk. Constitution can block by wrapper module, function name, or argument patterns.

### Risk Tag Model (replaces RISK_CLASS)
Composable `RISK_TAG` tags replace the mutually exclusive `RISK_CLASS` enum (`read_only`, `side_effects`, `high_ambiguity`). Tags are additive — a tool call carries a `Set<string>` of applicable tags.

**Tags:** `workspace`, `crosses_boundary`, `inbound`, `outbound`, `irreversible`, `external_audience`

**Routing logic:**
- **Empty/unknown tags → Simulate + Judge** (default-deny — prove it's safe)
- **`workspace`-only → Execute directly** (declared safe, git-versioned workspace)
- **Any boundary/irreversible/audience tags → Simulate + Judge** (bThread predicates inspect tag sets)

**Tag sources:**
- Built-in tools declare static tags (e.g., `read_file` → `{workspace}`)
- Wrapper modules declare tags at generation time from schema analysis
- No runtime classifier function — structural rules in bThreads, semantic understanding via Simulate/Judge
- Flywheel: snapshot patterns → propose new bThreads for recurring tag combinations → owner approves

**Gate events simplified:** Three gate variants (`gate_read_only`, `gate_side_effects`, `gate_high_ambiguity`) → single `gate_approved` with `tags: string[]`. Gate bThreads compose by inspecting tag sets, not switching on enum values.

**Defense in depth intact:** Git-versioned workspace + OS backups + constitution bThreads + Simulate/Judge pipeline. Tags determine *which* defenses engage, not *whether* defenses exist.

**Risk tags ↔ Modnet boundaries:** Risk tags (per-tool-call) and Modnet boundary tags (per-module `"boundary"` in `package.json`) are two levels of the same enforcement mechanism — BP bThread block predicates. Risk tags describe *what a tool call does*; boundary tags describe *what a module shares*. Both flow through the Gate → Execute pipeline as BP events. Connection point is **Phase 2 (Governance Factories)**: boundary policies become MAC bThread block predicates that inspect risk tags on `execute` events. A2A events (`share_module`, `share_data`, `payment_required`) will be added to `AGENT_EVENTS` when the A2A handler is built — they carry risk tags like any other tool call (`{crosses_boundary, outbound, external_audience}`).

### Bash Sandboxing — Bun Shell
Bash tool execution uses Bun Shell (`Bun.$`) for sandboxing:
- `$.cwd(workspace)` — locks working directory to workspace root
- `$.env()` — controls environment variables (allowlist, not passthrough)
- Auto-escaping — template literals prevent injection (`$\`echo ${userInput}\``)
- No system shell — Bun Shell is its own implementation, doesn't invoke `/bin/sh`
- `$.nothrow()` — prevents non-zero exit codes from throwing (tool handler manages errors)
- Constitution bThreads provide structural blocking (e.g., block `rm -rf`, block `/etc/` writes) via `execute` event predicates inspecting tool arguments

### Not Needed (dropped from pi-mono comparison)
- **Cross-provider message transformation** — no mid-session model swap; model replaced between sessions via retrain + redeploy
- **Partial/streaming JSON parsing** — handler accumulates tool call args privately, triggers `model_response` with complete parsed result
- **Pi-pods infrastructure management** — genome skills generate deployment code to user needs; not a framework export
- **Native MCP client** — MCP servers integrated via composable wrappers pattern above, not a built-in protocol client

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
- No mid-session model swap — model replaced between sessions via retrain + redeploy

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

## Tool Audit (from pi-mono audit session)

### Tool Categories

**Development/eval tools (keep as-is):** `eval/` (19K LOC harness), `scaffold-rules/`, `typescript-lsp/`, `validate-skill/` — independent of agent loop architecture.

**Agent pipeline tools (need work):** `crud/`, `constitution/`, `evaluate/`, `simulate/`, `memory/` — written before BP-first and pi-mono decisions were finalized. All import from `src/reference/agent.*` (reference types, not production types).

### Per-Tool Findings

**`crud/` — Partially Aligned**
- Individual handlers (readFile, writeFile, listFiles, bash) are clean and correct
- `createToolExecutor()` is a generic dispatcher — in BP-first, each tool call becomes its own BP event dispatched by per-tool bThreads (Wave 10 pattern). Centralized executor bypasses BP.
- No `AbortSignal` on bash — decided pattern requires it for request abort via BP interrupt
- `ToolContext` only has `workspace: string` — may need `signal: AbortSignal`
- **Action:** Keep handlers, rewrite executor for BP dispatch, add AbortSignal

**`constitution/` — Major Misalignment**
- `constitutionRule(config)` produces config objects, not governance factories `(trigger) => { threads?, handlers? }`
- `createConstitution(rules)` returns flat object with `.threads` + `.gateCheck` — not the factory shape
- No branding (`$: '🏛️'`), no MAC/DAC distinction, no `protectGovernance` bThread
- `classifyRisk()` is superseded by composable risk tags — tags declared at tool/wrapper definition time, not classified at runtime
- **Action:** Complete rewrite as governance factory pattern

**`evaluate/` — Partially Aligned**
- `buildRewardPrompt()`, `parseRewardScore()` — keep (WebDreamer A.4 utilities)
- `checkSymbolicGate()` — keep but relocate to Gate module (bThread block predicate, not evaluate)
- `createEvaluate()` returns standalone function — should be a BP handler for `simulation_result` event
- Uses `InferenceCall` (Promise-based) — needs `Model.reason()` (AsyncIterable)
- **Action:** Keep utilities, rewrite as BP handler, relocate symbolic gate

**`simulate/` — Partially Aligned**
- `buildStateTransitionPrompt()`, `parseSimulationResponse()` — keep (WebDreamer A.3 utilities)
- `createSimulate()` returns standalone function — should be a BP handler for `gate_approved` event
- Uses `InferenceCall` (Promise-based) — needs `Model.reason()` (AsyncIterable)
- Sub-agent pattern (`createSubAgentSimulate()`) may need rethinking with BP's native concurrency
- **Action:** Keep utilities, rewrite as BP handler

**`memory/` — Complete Misalignment**
- SQLite database (sessions, messages, event_log, FTS5) — design says JSON-LD files in git
- `useSnapshot` → JSON-LD decision files replaces event_log table
- Plans as bThreads replaces sessions table state
- Context assembly as BP event replaces `getMessages()`
- FTS5 still useful but ONLY for skill frontmatter/module manifests (package sidecar), not memory
- **Action:** Complete rewrite — search tool backend changes to hypergraph queries (git + grep over JSON-LD)

### Default Skills for Tools (agent-skills eval pattern)

Each default tool gets a skill (teaches agent usage) + eval prompts (tests tool in isolation via `@plaited/agent-eval-harness`). Pattern from `youdotcom-oss/agent-skills`: `prompts.jsonl` → `capture` command with headless adapter → `grader.ts` scores output.

| Skill | Tools Covered | Eval Focus |
|-------|--------------|------------|
| `file-operations` | read_file, write_file, list_files | CRUD correctness, path sandboxing, encoding |
| `bash-execution` | bash | Command execution, output parsing, error handling, AbortSignal |
| `search` | search (hypergraph query) | JSON-LD navigation, git grep, relevance |
| `planning` | save_plan | Plan step structure, dependency chains, goal coherence |
| `context-assembly` | (implicit) | Contributor ordering, budget allocation, pruning quality |

### Recommended Build Path

**Phase 0 — Production Types:** Extract from `src/reference/agent.types.ts` → `src/agent/agent.types.ts`. No reference imports in production code.

**Phase 1 — Tool Handlers (bottom-up, testable in isolation):**
1. Rewrite `crud/` handlers with AbortSignal
2. Create `search` handler for hypergraph queries (replaces memory/FTS5)
3. Extract `checkSymbolicGate()` into shared utilities (classifyRisk superseded by risk tags)
4. Extract `buildRewardPrompt()` + `buildStateTransitionPrompt()` into shared utilities

**Phase 2 — Governance Factories (constitution rewrite):**
1. Define governance factory type `(trigger) => { threads?, handlers? }` branded `$: '🏛️'`
2. Implement gate bThread predicates using composable risk tags
3. Implement default MAC rules (file sandboxing, bash safety via Bun Shell)

**Phase 3 — Pipeline Handlers (simulate + evaluate as BP handlers):**
1. Simulate handler for `gate_approved` events
2. Evaluate handler for `simulation_result` events
3. Wire both to `Model.reason()` AsyncIterable

**Phase 4 — Skills + Evals (testable via `@plaited/agent-eval-harness`):**
1. Create `prompts.jsonl` for each tool
2. Create graders
3. Run evals against Claude Code (as in agent-skills pattern)

## Build Progress

### Completed
- [x] `src/behavioral/` — BP engine (1128 tests passing)
- [x] `src/ui/` — rendering pipeline, controller protocol, custom elements
- [x] `src/server/` — thin I/O server node via `createServer()`
- [x] `src/reference/` — 10-wave agent loop reference implementation
- [x] `src/tools/eval/` — eval harness (19K LOC, production-ready)
- [x] Doc breakout: SYSTEM-DESIGN-V3.md → 8 focused domain docs
- [x] Pi-mono feature audit — decisions recorded above
- [x] Tool audit — findings and build path recorded above
- [x] Phase 0 — Production types (`src/agent/`) extracted from reference, risk tag model applied

### Next Up
- [ ] Tool rewrite Phase 1–3 (see Tool Audit § Recommended Build Path)
- [ ] Default tool skills + evals Phase 4
- [ ] WebAuthn auth (passkey registration/verification via SimpleWebAuthn)
- [ ] `src/agent/` — agent loop implementation (from reference → production)
- [ ] Update `docs/ARCHITECTURE.md` with Model interface changes (AsyncIterable, Vision role, usage field)
- [ ] Genome skills restructuring (seeds/tools/eval directories)
- [ ] Resolve open questions above as implementation reveals answers
