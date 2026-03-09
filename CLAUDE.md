@AGENTS.md

## Testing

**Always use `bun test src/`** — never bare `bun test`. The `skills/` directory contains copied test assets with broken module paths that are not meant to be tested directly. The `package.json` `test` script scopes tests to `src/` only.

## Skills Directory

Skills live in `skills/` at the project root (not `.agents/skills/` or `.claude/skills/`). Each skill follows the [AgentSkills specification](https://agentskills.io/specification) with a `SKILL.md` containing YAML frontmatter (`name`, `description`) and optional `references/` directory.

```
skills/
├── trial-runner/         # Running trials with adapters
├── trial-adapters/       # Writing adapter scripts for trial runner
├── compare-trials/       # Statistical comparison of trial results
├── typescript-lsp/       # LSP symbol search
├── code-documentation/   # TSDoc standards
├── validate-skill/       # Skill validation
└── ...
```

Validate with: `bunx @plaited/development-skills validate-skill skills/`

## Greenfield Mindset

This is **greenfield code with zero external consumers**. There are no backward-compatibility concerns. Don't preserve patterns or APIs "just in case." If something is unused, delete it. If a simpler approach exists, use it.

## BP-First Architecture Principles

These patterns apply to all BP-orchestrated code (`src/behavioral/`, `src/ui/`, and new server/agent code):

1. **Blocking prevents handler execution, not observability.** A blocked event won't fire its handler, but `useSnapshot` captures all BP engine decisions — selections, blocks, interrupts. The controller sends every snapshot to the server (`controller.ts:196-200`). The server sees everything. If you need a side effect for a blocked event (like a rejection message), the handler must check and produce it — don't rely on the block alone.

2. **Pipeline pass-through > conditional bypass.** Events should flow through the full pipeline. When a seam is absent, the handler passes through — don't short-circuit with conditionals.
   - **DON'T:** `if (actionCalls.length > 0) { bThreads.set({ batchCompletion... }) }` — conditional bThread creation means structural coordination exists only sometimes.
   - **DO:** Always create `batchCompletion`. Zero-length batch completes immediately (zero `waitFor` iterations from empty `Array.from`) and the loop progresses normally.

3. **Thin handlers, structural coordination.** Handlers do ONE thing. Routing and lifecycle belong in bThreads. If a handler has `if/else` branches that produce different event types, it's doing routing — split into separate handlers or move routing into bThread block predicates.
   - **DON'T:** A `model_response` handler that filters arrays (`savePlanCalls` vs `actionCalls`), conditionally creates bThreads, and has an else-branch for text-only messages — that's three responsibilities.
   - **DO:** Every tool call becomes a `context_ready` event. Each handler inspects ONE tool call. Routing (save_plan vs action) happens via event type or bThread predicates. `batchCompletion` always exists. Text-only response triggers `message` directly from inference.

4. **Additive composition.** Use unparameterized `behavioral()` — handlers self-validate with Zod at boundaries. Wire up what you need, ignore the rest.

5. **No backward compatibility for greenfield.** Always-full is simpler than configurable.

6. **Register once, not per-task.** Session-level subscriptions (`useFeedback`, `useSnapshot`) are registered once at agent creation. Dynamic coordination uses bThreads (which ARE per-task). Don't register/teardown feedback handlers on every task.
   - **DON'T:** `disconnectObserver?.(); disconnectObserver = useFeedback({...})` inside a `task` handler.
   - **DO:** Register all feedback handlers once in `createAgentLoop`. Use per-task bThreads for lifecycle coordination (they self-terminate via interrupt or completion).

7. **One check, one location.** Don't duplicate safety checks across handlers. If a symbolic gate runs in the `simulate_request` handler to create a `safety_{id}` bThread, don't also run it in `eval_approved`. The bThread blocks structurally; the handler produces the workflow event (`eval_rejected`). They are complementary, not redundant copies of the same logic.

## Agent Loop BP Patterns

Concrete BP coordination patterns for building `createAgentLoop()` in `src/agent/`. All code sketches use production types from `src/agent/` and BP primitives from `src/behavioral/`.

### Event Vocabulary

The 6-step loop maps to these production events (from `agent.constants.ts`):

| Step | Events | Produced by | Consumed by |
|------|--------|-------------|-------------|
| Context | `task` | adapter (external trigger) | task handler → triggers `invoke_inference` |
| Reason | `invoke_inference`, `model_response` | task handler / batchCompletion bThread, inference handler | inference handler, dispatch handler |
| Gate | `context_ready`, `gate_approved`, `gate_rejected` | dispatch handler, gate handler | gate handler, gate_approved handler / rejection handler |
| Simulate | `simulate_request`, `simulation_result` | gate_approved handler, simulate handler | simulate handler, evaluate handler |
| Evaluate | `eval_approved`, `eval_rejected` | evaluate handler | execute trigger / rejection handler |
| Execute | `execute`, `tool_result` | gate_approved / eval_approved handler, execute handler | execute handler, batchCompletion bThread |

Streaming side-channels (`thinking_delta`, `text_delta`, `inference_error`, `tool_progress`) don't affect loop flow — they're triggered by handlers for progressive UI.

**Structural events** (coordinated by bThreads — block/waitFor/interrupt targets):
- `task` / `message` — taskGate phase transitions
- `execute` — blocked by sim_guard, safety, maxIterations, constitution bThreads
- `tool_result` / `gate_rejected` / `eval_rejected` — counted by batchCompletion
- `invoke_inference` — requested by batchCompletion after batch completes

**Handler-produced events** (side effects via useFeedback):
- `invoke_inference` — triggered by task handler (first call)
- `model_response` — triggered by inference handler after stream completes
- `context_ready` — triggered per tool call from dispatch handler
- `gate_approved` / `gate_rejected` — triggered by gate handler
- `simulate_request` — triggered by gate_approved handler (non-workspace tags)
- `simulation_result` — triggered by simulate handler after async prediction
- `eval_approved` / `eval_rejected` — triggered by evaluate handler
- `execute` — triggered by gate_approved handler (workspace-only) or eval_approved handler
- `tool_result` — triggered by execute handler after tool runs

### Pattern: Phase-Transition Gate (taskGate)

Two-phase bThread that alternates between blocking and allowing. Thread position IS coordination state — no boolean flag needed.

```typescript
const PIPELINE_EVENTS = new Set([
  AGENT_EVENTS.invoke_inference, AGENT_EVENTS.model_response,
  AGENT_EVENTS.context_ready, AGENT_EVENTS.gate_approved,
  AGENT_EVENTS.gate_rejected, AGENT_EVENTS.simulate_request,
  AGENT_EVENTS.simulation_result, AGENT_EVENTS.eval_approved,
  AGENT_EVENTS.eval_rejected, AGENT_EVENTS.execute,
  AGENT_EVENTS.tool_result, AGENT_EVENTS.save_plan,
  AGENT_EVENTS.plan_saved,
])

bThreads.set({
  // Session gate: blocks everything until client connects
  sessionGate: bThread([
    bSync({
      waitFor: UI_ADAPTER_LIFECYCLE_EVENTS.client_connected,
      block: (e) => PIPELINE_EVENTS.has(e.type) || e.type === AGENT_EVENTS.task,
    }),
    bSync({ waitFor: UI_ADAPTER_LIFECYCLE_EVENTS.client_disconnected }),
  ], true),

  // Task gate: blocks pipeline events between tasks (serial execution)
  taskGate: bThread([
    bSync({
      waitFor: AGENT_EVENTS.task,
      block: (e) => PIPELINE_EVENTS.has(e.type),
      interrupt: [UI_ADAPTER_LIFECYCLE_EVENTS.client_disconnected],
    }),
    bSync({
      waitFor: AGENT_EVENTS.message,
      interrupt: [UI_ADAPTER_LIFECYCLE_EVENTS.client_disconnected],
    }),
  ], true),
})
```

Stale async triggers (e.g., `tool_result` arriving after task ends) are silently blocked because `taskGate` is back at phase 1. Replaces `if (done) return` checks in handlers.

### Pattern: Per-Call Dynamic Threads (sim_guard)

Each tool call gets its own scoped bThread. Blocks `execute` for THIS call until `simulation_result` arrives. Self-terminates via predicate interrupt. No shared mutable state.

```typescript
// Created in gate_approved handler when tags require simulation
const id = toolCall.id
bThreads.set({
  [`sim_guard_${id}`]: bThread([
    bSync({
      block: (e) => e.type === AGENT_EVENTS.execute && e.detail?.toolCall?.id === id,
      interrupt: [
        (e) => e.type === AGENT_EVENTS.simulation_result && e.detail?.toolCall?.id === id,
      ],
    }),
  ]),
})
```

Multiple `sim_guard_*` threads coexist for parallel tool calls — each scoped by ID, no interference. Observable via `useSnapshot` (`blockedBy: "sim_guard_tc-1"`).

### Pattern: Batch Completion Coordination

Waits for N completion events in any order, then requests next inference. **Always created** — zero-length batch completes immediately (see principle 2).

```typescript
const isCompletion = (e: { type: string }) =>
  e.type === AGENT_EVENTS.tool_result ||
  e.type === AGENT_EVENTS.gate_rejected ||
  e.type === AGENT_EVENTS.eval_rejected

// Created in dispatch handler after triggering context_ready per tool call
bThreads.set({
  batchCompletion: bThread([
    ...Array.from({ length: toolCalls.length }, () =>
      bSync({ waitFor: isCompletion, interrupt: [AGENT_EVENTS.message] }),
    ),
    bSync({
      request: { type: AGENT_EVENTS.invoke_inference },
      interrupt: [AGENT_EVENTS.message],
    }),
  ]),
})
```

Every sync point has `interrupt: [AGENT_EVENTS.message]` — if `message` fires (text-only response, max iterations, user interrupt), `batchCompletion` is torn down cleanly. Thread name reused next model response.

### Pattern: Risk Tag Routing via gate_approved

Single `gate_approved` event with `tags: string[]` replaces three separate gate events. Handler inspects tag sets for routing.

```typescript
useFeedback({
  [AGENT_EVENTS.gate_approved]({ toolCall, tags }: GateApprovedDetail) {
    const tagSet = new Set(tags)
    // workspace-only → execute directly (skip simulation)
    if (tagSet.size > 0 && [...tagSet].every((t) => t === RISK_TAG.workspace)) {
      trigger({ type: AGENT_EVENTS.execute, detail: { toolCall, tags } })
      return
    }
    // Any other tags (or empty/unknown) → simulate + evaluate
    bThreads.set({
      [`sim_guard_${toolCall.id}`]: bThread([
        bSync({
          block: (e) => e.type === AGENT_EVENTS.execute && e.detail?.toolCall?.id === toolCall.id,
          interrupt: [
            (e) => e.type === AGENT_EVENTS.simulation_result && e.detail?.toolCall?.id === toolCall.id,
          ],
        }),
      ]),
    })
    trigger({ type: AGENT_EVENTS.simulate_request, detail: { toolCall, tags } })
  },
})
```

Note: the `if` here is acceptable — it's a single routing decision in a thin handler, not multi-branch orchestration. The handler does ONE thing: route to execute or simulate. The structural coordination (blocking execute until simulation completes) is in the `sim_guard` bThread.

### Pattern: Synthetic Tool Results for Rejected Events

Thin handlers that add to history so the model sees feedback on next inference. `batchCompletion` already counts `gate_rejected` and `eval_rejected` as completion events.

```typescript
useFeedback({
  [AGENT_EVENTS.gate_rejected]({ toolCall, decision }: GateRejectedDetail) {
    history.push({
      role: 'tool',
      content: JSON.stringify({ error: decision.reason ?? 'Rejected by gate' }),
      tool_call_id: toolCall.id,
    })
  },
  [AGENT_EVENTS.eval_rejected]({ toolCall, reason }: EvalRejectedDetail) {
    history.push({
      role: 'tool',
      content: JSON.stringify({ error: `Eval rejected: ${reason}` }),
      tool_call_id: toolCall.id,
    })
  },
})
```

### Pattern: maxIterations as Per-Task bThread

Created fresh per task in the `task` handler. Counts N `tool_result` events, then blocks `execute` + requests `message`. Interrupted by `message` at task end, freeing thread name for reuse.

```typescript
// In task handler:
bThreads.set({
  maxIterations: bThread([
    ...Array.from({ length: MAX_ITERATIONS }, () =>
      bSync({ waitFor: AGENT_EVENTS.tool_result, interrupt: [AGENT_EVENTS.message] }),
    ),
    bSync({
      block: AGENT_EVENTS.execute,
      request: { type: AGENT_EVENTS.message, detail: { content: `Max iterations (${MAX_ITERATIONS}) reached` } },
      interrupt: [AGENT_EVENTS.message],
    }),
  ]),
})
```

### Pattern: Constitution as Additive Blocking Threads

Each safety rule is an independent bThread with `repeat: true`. New rules compose without modifying existing ones. Governance factories produce these — `(trigger) => { threads?, handlers? }`.

```typescript
// MAC rules loaded at spawn, immutable
bThreads.set({
  noEtcWrites: bThread([
    bSync({
      block: (e) => e.type === AGENT_EVENTS.execute &&
        e.detail?.toolCall?.function?.name === 'bash' &&
        e.detail?.toolCall?.function?.arguments?.command?.includes('/etc/'),
    }),
  ], true),

  noRmRf: bThread([
    bSync({
      block: (e) => e.type === AGENT_EVENTS.execute &&
        e.detail?.toolCall?.function?.name === 'bash' &&
        e.detail?.toolCall?.function?.arguments?.command?.includes('rm -rf'),
    }),
  ], true),
})
```

### Handler Granularity Guide

| Responsibility | Where | Why |
|---------------|-------|-----|
| Event routing (which event type next) | Thin handler with single routing decision, or bThread block predicates | Structural, observable, composable |
| Side effects (inference, tool exec, history) | `useFeedback` handler | Async, fire-and-forget |
| Lifecycle coordination (task start/end, batch) | bThreads with `repeat: true` | Thread position is state |
| Safety constraints (block dangerous ops) | bThread block predicates, `repeat: true` | Additive, composable, observable via snapshot |
| Per-call scoping (sim guard, safety net) | Dynamic bThreads with predicate interrupt | Self-terminating, no shared mutable state |
| Observability / persistence | `useSnapshot` listener, registered once | Decoupled from handlers, captures all decisions |

### Anti-Pattern Summary

These patterns from the legacy reference must NOT be reproduced:

1. **Array filtering in handlers** — don't imperatively separate `savePlanCalls` from `actionCalls`. Each tool call → one `context_ready` event. (Violates principle 3)
2. **Conditional bThread creation** — don't wrap `bThreads.set()` in `if (length > 0)`. Always set the bThread. (Violates principle 2)
3. **Duplicate safety checks** — don't run the same check in both `simulate_request` and `eval_approved`. Check once, let the bThread block structurally. (Violates principle 7)
4. **Per-task observer re-registration** — don't `disconnect(); reconnect = useFeedback({...})` in the `task` handler. Register once. (Violates principle 6)
5. **Multi-branch handler routing** — don't put `if/else if/else` chains in `model_response` that produce different event types. Split into thin handlers. (Violates principle 3)
6. **Three separate gate events** — don't use `gate_read_only` / `gate_side_effects` / `gate_high_ambiguity`. Use single `gate_approved` with `tags: string[]`.

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

**BP coordination patterns** for the agent loop are documented in the **Agent Loop BP Patterns** section above. See `docs/AGENT-LOOP.md` for the authoritative 6-step loop design.

**What exists:**
- `src/behavioral/` — BP engine (`behavioral()`, `bThread`, `bSync`, `trigger`, `useFeedback`, `useSnapshot`)
- `src/ui/` — rendering pipeline, controller protocol, custom elements (see `docs/UI.md`)
- `src/server/` — thin I/O server node via `createServer()` (routes, WebSocket, pub/sub, hot reload). Auth routes (`/auth/register`, `/auth/verify`) return 501 stubs — WebAuthn implementation is next.


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
- **Hypergraph memory** — BP decisions as git-versioned JSON-LD files in `.memory/` at module root (and node root)
- `.memory/` co-located with code in each module's git repo — commits bind reasoning to code state
- **Per-side-effect commits** — git commit on `tool_result` from write_file/edit_file/bash, bundling code change + all pending decision `.jsonld` files. Final commit at session end.
- `useSnapshot` captures every BP decision (selections, blocks, interrupts) + every tool result
- Plans as bThreads — no external state, step dependencies are `waitFor`/`block` in BP engine
- Context assembly as BP event with contributor handlers
- Agent uses bash + git + grep for structural queries against its own workspace
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

## CLI Tool Pattern (established via validate-skill rewrite)

All `plaited` CLI tools follow this contract. Reference implementation: `src/tools/validate-skill.ts`.

### I/O Contract
- **Input**: JSON as first positional arg or piped via stdin. Validated with Zod `.parse()`.
- **Output**: JSON on stdout. Errors on stderr.
- **Discovery**: `--schema input` and `--schema output` emit `z.toJSONSchema()` for the respective Zod schemas.
- **Help**: `--help` / `-h` prints usage and exits 0.
- **Exit codes**: 0 = success, 1 = domain error (e.g. validation failed), 2 = bad input / tool error.

### File Structure
Flat layout — tool files live directly in `src/tools/`, tests in `src/tools/tests/`. Each tool exports both **library functions** (pure, no side effects) and a **CLI handler** (owns `process.exit`, `console.log`):
```
src/tools/
├── cli.utils.ts          # Shared CLI factories (parseCli, makeCli)
├── tool-name.ts          # Library exports + CLI handler
├── tool-name.schemas.ts  # Optional — split when schemas are shared or large
├── tool-name.utils.ts    # Optional — split when utilities are large
├── tests/
│   └── tool-name.spec.ts
```
- Library functions: exported for in-process use. No `process.exit()`, no `console.log`.
- CLI handler: single exported `async (args: string[]) => void`. Handles `--schema`, `--help`, input parsing, exit codes.
- Zod schemas: exported (`InputSchema`, `OutputSchema`) so consumers can validate without running the CLI.

### Conventions
- **Bun.YAML.parse()** for any YAML parsing — no custom parsers. YAML 1.2 compliant.
- **Spec-fidelity**: Output field names match their source spec verbatim. If the AgentSkills spec says `allowed-tools` (dash-case), the output says `allowed-tools` — don't camelCase.
- **`z.record(z.string(), z.string())`** not `z.record(z.string())` — Zod v4's `toJSONSchema()` needs explicit key+value type args.
- **`node:util` parseArgs removed** — input is always JSON, not CLI flags with positional args.

### Migration Status
- `validate-skill/` — **done** (reference implementation)
- `crud/` — **done** (Phase 1: production imports, Bun Shell bash, risk tags, edit_file, JSON positional arg CLI, deleted createToolExecutor)
- `constitution/`, `simulate/`, `evaluate/`, `memory/` — full rewrites pending (see Tool Audit below)
- `eval/` → `trial` — **done** (19K LOC eval harness rebuilt as 4-file trial runner: `trial.ts`, `trial.schemas.ts`, `trial.utils.ts`, `trial.constants.ts`. Library-first API, script-based adapters, unified TrialResult, `compare-trials` skill)
- `typescript-lsp/` — **done** (consolidated lsp-client.ts into lsp.ts, agent types, shared CLI utils)
- `scaffold-rules/` — **deleted** (AGENTS.md ships in package, copied by skill)

## Tool Audit (from pi-mono audit session)

### Tool Categories

**Development tools:** `trial` (library-first trial runner with script-based adapters), `typescript-lsp/` (LSP symbol search, exports agent types), `validate-skill/` (AgentSkills spec validation). `scaffold-rules/` deleted (AGENTS.md ships in package).

**Agent pipeline tools:** `constitution/`, `evaluate/`, `simulate/`, `memory/` — **deleted**. All were written before BP-first and pi-mono decisions were finalized (reference imports, `RISK_CLASS` enum, standalone factory functions instead of BP handlers, Promise-based `InferenceCall` instead of `Model.reason()` AsyncIterable). Misalignment too deep for incremental migration — rebuild from scratch in Phases 2–3.

`crud/` — **Phase 1 complete.** Production imports from `src/agent/`, Bun Shell bash, risk tags, edit_file added, createToolExecutor deleted. `builtInToolSchemas` removed (per-tool schemas instead). Shared CLI utils extracted to `src/tools/cli.utils.ts`.

### Default Skills for Tools (agent-skills eval pattern)

Each default tool gets a skill (teaches agent usage) + eval prompts (tests tool in isolation via the trial runner). Pattern: `prompts.jsonl` → adapter script → `grader.ts` scores output → `runTrial()` or `plaited trial`.

| Skill | Tools Covered | Eval Focus |
|-------|--------------|------------|
| `file-operations` | read_file, write_file, list_files | CRUD correctness, path sandboxing, encoding |
| `bash-execution` | bash | Command execution, output parsing, error handling, AbortSignal |
| `search` | search (hypergraph query) | JSON-LD navigation, git grep, relevance |
| `planning` | save_plan | Plan step structure, dependency chains, goal coherence |
| `context-assembly` | (implicit) | Contributor ordering, budget allocation, pruning quality |

### Recommended Build Path

**Phase 0 — Production Types:** Extract from `src/reference/agent.types.ts` → `src/agent/agent.types.ts`. No reference imports in production code.

**Phase 1 — Tool Handlers (`crud/` upgrade, testable in isolation):**
1. Migrate `crud/` imports from `src/reference/` → `src/agent/` (production `ToolContext` already has `signal: AbortSignal`)
2. Rewrite bash handler with Bun Shell (`$.cwd(workspace)`, `$.env()`, AbortSignal)
3. Add risk tag registry — static `RISK_TAG` declarations per built-in tool alongside `builtInToolSchemas`
4. Delete `createToolExecutor()` — BP dispatch replaces centralized dispatcher
5. Add `edit_file` handler (listed in docs as default tool, doesn't exist yet)

**Phase 2 — Governance Factories (build from scratch):**
1. Define governance factory type `(trigger) => { threads?, handlers? }` branded `$: '🏛️'`
2. Implement gate bThread predicates using composable risk tags
3. Implement default MAC rules (file sandboxing, bash safety via Bun Shell)
4. `protectGovernance` bThread blocking modification of MAC paths

**Phase 3 — Pipeline Handlers (build from scratch as BP handlers):**
1. Simulate handler for `gate_approved` events — builds State Transition Prompt (WebDreamer A.3), calls `Model.reason()`, triggers `simulation_result`
2. Evaluate handler for `simulation_result` events — symbolic gate (regex/keyword block predicates) + neural scorer (WebDreamer A.4 reward prompt), triggers `eval_approved` or `eval_rejected`
3. Per-call dynamic threads with predicate interrupt for simulation guards (`sim_guard_{id}` pattern)
4. Prompt utilities (buildStateTransitionPrompt, buildRewardPrompt, checkSymbolicGate, parseRewardScore) written fresh to use production types

**Phase 4 — Skills + Evals (testable via trial runner):**
1. Create `prompts.jsonl` for each tool
2. Create adapter scripts + graders
3. Run evals via `runTrial()` or `plaited trial`

## Build Progress

### Completed
- [x] `src/behavioral/` — BP engine (1128 tests passing)
- [x] `src/ui/` — rendering pipeline, controller protocol, custom elements
- [x] `src/server/` — thin I/O server node via `createServer()`
- [x] `src/reference/` — 10-wave agent loop reference (deleted — BP patterns extracted to CLAUDE.md "Agent Loop BP Patterns")
- [x] `src/tools/eval/` → `src/tools/trial.*` — eval harness rebuilt as trial runner (4 files, library-first, script-based adapters, `compare-trials` skill)
- [x] Doc breakout: SYSTEM-DESIGN-V3.md → 8 focused domain docs
- [x] Pi-mono feature audit — decisions recorded above
- [x] Tool audit — findings and build path recorded above
- [x] Phase 0 — Production types (`src/agent/`) extracted from reference, risk tag model applied
- [x] `validate-skill/` — rewritten for agent consumption (Bun.YAML, JSON I/O, --schema, library exports)
- [x] Deleted pre-production tools (`simulate/`, `memory/`, `evaluate/`, `constitution/`) — misaligned with BP-first architecture, rebuild from scratch in Phases 2–3
- [x] Deleted `scaffold-rules/` — AGENTS.md ships in package, skill replaces CLI tool
- [x] Phase 1 — `crud/` upgrade (production imports, Bun Shell bash, risk tags, edit_file, JSON positional arg CLI, deleted createToolExecutor)
- [x] `typescript-lsp/` — consolidated lsp-client.ts into lsp.ts, added agent types (ToolHandler, ToolDefinition, RISK_TAG), shared CLI utils (`src/tools/cli.utils.ts`)
- [x] Extracted shared CLI utils (`parseCli`, `makeCli`) to `src/tools/cli.utils.ts`, removed `builtInToolSchemas` from crud (per-tool schemas instead), deleted stale `src/tools.ts`

### Next Up
- [ ] Phase 2–3 — Governance factories + pipeline handlers (see Recommended Build Path)
- [ ] Default tool skills + evals Phase 4
- [ ] WebAuthn auth (passkey registration/verification via SimpleWebAuthn)
- [ ] `src/agent/` — agent loop implementation (from reference → production)
- [ ] Update `docs/ARCHITECTURE.md` with Model interface changes (AsyncIterable, Vision role, usage field)
- [ ] Genome skills restructuring (seeds/tools/eval directories)
- [ ] Resolve open questions above as implementation reveals answers
