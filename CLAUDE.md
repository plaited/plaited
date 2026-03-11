@AGENTS.md

## Testing

**Always use `bun test src/`** — never bare `bun test`. The `skills/` directory contains copied test assets with broken module paths that are not meant to be tested directly. The `package.json` `test` script scopes tests to `src/` only.

## Skills Directory

Skills live in `skills/` at the project root (not `.agents/skills/` or `.claude/skills/`). Each skill follows the [AgentSkills specification](https://agentskills.io/specification) with a `SKILL.md` containing YAML frontmatter (`name`, `description`) and optional `scripts/`, `references/`, `assets/` directories.

```
skills/
├── remote-mcp-integration/ # Generate skills from remote MCP servers
├── search-bun-docs/        # Search Bun documentation via MCP
├── search-mcp-docs/        # Search MCP specification via MCP
├── search-agent-skills/    # Search AgentSkills specification via MCP
├── trial-runner/            # Running trials with adapters
├── trial-adapters/          # Writing adapter scripts for trial runner
├── compare-trials/          # Statistical comparison of trial results
├── typescript-lsp/          # LSP symbol search
├── code-documentation/      # TSDoc standards
├── validate-skill/          # Skill validation
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

Building top-down: UI → WebSocket server → agent loop. The full stack (agent + UI) is a Modnet node.

**Key docs:**
- `docs/ARCHITECTURE.md` — top-level overview, first principles, pluggable models, deployment tiers
- `docs/AGENT-LOOP.md` — 6-step loop, selective simulation, ACP interface, default tools
- `docs/SAFETY.md` — composable risk tags, defense in depth (6 layers)
- `docs/CONSTITUTION.md` — governance factories, neuro-symbolic split, MAC/DAC
- `docs/HYPERGRAPH-MEMORY.md` — git-versioned JSON-LD memory, context assembly, plans as bThreads
- `docs/TRAINING.md` — distillation pipeline, training tiers, flywheel
- `docs/PROJECT-ISOLATION.md` — multi-project orchestrator, IPC bridge, tool layers
- `docs/MODNET-IMPLEMENTATION.md` — modnet topology, A2A protocol, identity, access control, payment, module sidecar
- `docs/GENOME.md` — genome architecture for skills (seeds/tools/eval split, CONTRACT frontmatter, wave ordering)
- `docs/UI.md` — current `src/ui/` architecture (rendering, protocol, custom elements)
- `docs/WEBSOCKET-ARCHITECTURE.md` — open design questions for the WebSocket server layer
- `docs/Modnet.md` — Modnet design standards (MSS bridge-code tags, module structure)
- `docs/Structural-IA.md` — design grammar (objects, channels, levers, loops, modules, blocks)

**What exists:**
- `src/behavioral/` — BP engine (`behavioral()`, `bThread`, `bSync`, `trigger`, `useFeedback`, `useSnapshot`)
- `src/ui/` — rendering pipeline, controller protocol, custom elements
- `src/server/` — thin I/O server via `createServer()` (routes, WebSocket, pub/sub, hot reload). Auth routes return 501 stubs.
- `src/agent/` — production types (`agent.types.ts`, `agent.schemas.ts`, `agent.constants.ts`, `agent.utils.ts`)
- `src/tools/` — `crud/` handlers, `trial.*`, `validate-skill.ts`, `lsp.ts`, `cli.utils.ts`, `tools.registry.ts`, `hypergraph.schemas.ts`

**What's next:** WebAuthn auth → agent loop (`createAgentLoop()`) → governance factories.

**Server notes** (`src/server/server.ts`):
- Stateless connector (no BP) — browser ↔ agent BP
- `BunRequest` has `req.cookies`; `Request` fallback needs `new Bun.CookieMap()`
- WebSocket: `data: {} as WebSocketData`, pub/sub topics: `sessionId` and `sessionId:tagName`
- `server.reload()` merges new routes for hot-swap

## Decided (from pi-mono audit)

Key implementation decisions. See `docs/ARCHITECTURE.md`, `docs/SAFETY.md`, `docs/CONSTITUTION.md`, `docs/HYPERGRAPH-MEMORY.md`, `docs/MODNET-IMPLEMENTATION.md` for full context.

**Model interface:** `Model.reason(context, signal) → AsyncIterable<ModelDelta>`. Deltas: `thinking_delta`, `text_delta`, `toolcall_delta`, `done`, `error`. `ModelResponse` includes `usage: { inputTokens, outputTokens }`. OpenAI-compatible wire format.

**Three model roles** (infrastructure called by handlers, NOT tool calls):
- **Model** (required) — reasoning + tool calls
- **Indexer** (deferred) — `embed(text) → Float32Array`
- **Vision** (deferred) — `analyze(image, prompt) → VisionResponse`

**Prompt caching:** System prompt pinned per session, immutable. Inference server KV-cache handles prefix caching. Dynamic content (history, plan state) after the stable prefix.

**Context overflow:** Pre-flight budget check → prune (history first → inactive tools → plan detail) → reactive retry on tokenizer mismatch.

**Inference retry:** Exponential backoff mirroring `controller.ts` pattern. Transient (429, 5xx, OOM) → retry. Context overflow → re-assemble. Permanent → surface to user.

**Request abort:** BP `interrupt` + `AbortSignal` propagation to `fetch()` and `Bun.spawn()`.

**Streaming UI:** Inference handler → BP events (`thinking_delta`, `text_delta`) → `render` messages. BP IS the streaming protocol.

**External tool integration:** Discover schema → generate TypeScript wrapper → teach via skill → agent composes scripts. Implemented for MCP Streamable HTTP via `src/tools/remote-mcp-client.ts` (CLI tool + library over `@modelcontextprotocol/sdk`) + `skills/remote-mcp-integration/` (meta-skill teaching the pattern). Three search skills generated: `search-bun-docs`, `search-mcp-docs`, `search-agent-skills`. Skills shell out via `Bun.$` to `plaited remote-mcp-client` — no library import.

**Risk tags:** Implemented in `agent.constants.ts`. Tags: `workspace`, `crosses_boundary`, `inbound`, `outbound`, `irreversible`, `external_audience`. Empty/unknown → simulate+judge; workspace-only → execute directly; boundary/irreversible/audience → simulate+judge.

**Bash sandboxing:** Bun Shell (`Bun.$`) — `$.cwd()`, `$.env()`, auto-escaping, `$.nothrow()`. Constitution bThreads block dangerous patterns via `execute` event predicates.

**Training weights:** Training weight = `outcome × process`. BP snapshots (`DecisionStep` in `TrajectoryStep`) provide deterministic process signal without a learned PRM. `GradingDimensions` separates outcome, process, and efficiency scoring. `withMetaVerification` wraps graders with confidence scoring. Augmented self-distillation: bootstrap (shadowing) → refinement (self-vs-self) → probing (adversarial). See `docs/TRAINING.md`.

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

## CLI Tool Pattern

All `plaited` CLI tools follow this contract. Reference: `src/tools/validate-skill.ts`.

**I/O:** JSON in (first positional arg or stdin, Zod `.parse()`), JSON out (stdout), errors on stderr. `--schema input`/`--schema output` for discovery. `--help`/`-h` for usage. Exit: 0 success, 1 domain error, 2 bad input.

**File structure:**
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

**Conventions:**
- `Bun.YAML.parse()` for YAML — no custom parsers
- Spec-fidelity: output field names match source spec verbatim (dash-case if spec says dash-case)
- `z.record(z.string(), z.string())` not `z.record(z.string())` — Zod v4 `toJSONSchema()` needs explicit key+value

## Build Path

**Phase 2 — Governance Factories (from scratch):**
1. Governance factory type `(trigger) => { threads?, handlers? }` branded `$: '🏛️'`
2. Gate bThread predicates using composable risk tags
3. Default MAC rules (file sandboxing, bash safety via Bun Shell)
4. `protectGovernance` bThread blocking modification of MAC paths

**Phase 3 — Pipeline Handlers (from scratch as BP handlers):**
1. Simulate handler — State Transition Prompt (WebDreamer A.3), `Model.reason()`, triggers `simulation_result`
2. Evaluate handler — symbolic gate + neural scorer (WebDreamer A.4), triggers `eval_approved`/`eval_rejected`
3. Per-call dynamic threads (`sim_guard_{id}` pattern)
4. Prompt utilities fresh from production types

**Phase 4 — Skills + Evals:**
1. `prompts.jsonl` per tool → adapter scripts → graders
2. Run via `runTrial()` or `plaited trial`

| Skill | Tools Covered | Eval Focus |
|-------|--------------|------------|
| `file-operations` | read_file, write_file, list_files | CRUD correctness, path sandboxing, encoding |
| `bash-execution` | bash | Command execution, output parsing, error handling, AbortSignal |
| `search` | search (hypergraph query) | JSON-LD navigation, git grep, relevance |
| `planning` | save_plan | Plan step structure, dependency chains, goal coherence |
| `context-assembly` | (implicit) | Contributor ordering, budget allocation, pruning quality |

**Phase 4b — Training Pipeline Improvements:**
1. `DecisionStepSchema` in trajectories — BP snapshots as process signal
2. `GradingDimensionsSchema` — multi-dimensional grading (outcome, process, efficiency)
3. `withMetaVerification` grader wrapper — confidence scoring for grader outputs
4. Augmented self-distillation pipeline (bootstrap → refinement → probing)
5. Self-vs-self comparison (k parallel instances, dimensional breakdown)

## Next Up

- [ ] WebAuthn auth (passkey registration/verification via SimpleWebAuthn)
- [ ] `src/agent/` — agent loop implementation (`createAgentLoop()`)
- [ ] Phase 2–3 — Governance factories + pipeline handlers
- [ ] Phase 4 — Default tool skills + evals
- [ ] Genome skills restructuring (seeds/tools/eval directories)
