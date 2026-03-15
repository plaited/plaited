@AGENTS.md

## Testing

**Always use `bun test src/ skills/`** — never bare `bun test`. Skill tests live in `skills/*/scripts/tests/*.spec.ts`.

## Greenfield Mindset

This is **greenfield code with zero external consumers**. No backward-compatibility concerns. If something is unused, delete it. If a simpler approach exists, use it.

## Active Work Context

**What exists:**
- `src/behavioral/` — BP engine (100% implemented)
- `src/ui/` — rendering pipeline, controller protocol, custom elements
- `src/server/` — thin I/O server with `validateSession` seam, WebSocket replay buffer, CSP headers
- `src/agent/` — `createAgentLoop()`, governance, gate, simulate, evaluate, context assembly, branded factories, goal persistence, proactive heartbeat, snapshot writer, memory handlers, reingest handlers
- `src/tools/` — CRUD handlers, trial/training/grader, hypergraph (WASM), ingestion CLI, LSP, skill discovery/validation
- `src/a2a/` — HTTP + WebSocket bindings, push notifications, known-peers TOFU trust store, Agent Card JWS signing
- `src/modnet/` — node role constants, Agent Card metadata conventions

**What's next:**
- [ ] Server + agent integration (wiring `createServer` with `createAgentLoop`)
- [ ] Tool improvements (truncation, grep, scan-assisted edit) — see PROMPTS.md
- [ ] Docs → skills migration — see PROMPTS.md Group D
- [ ] Genome skills restructuring (seeds/tools/eval directories)

## Key Decisions (Affecting Future Work)

**Model interface:** `Model.reason(context, signal) → AsyncIterable<ModelDelta>`. OpenAI-compatible wire format.

**Three model roles:** Model (required), Indexer (deferred), Vision (deferred).

**Context management:** Tiered hot/warm/cold (Variant D). Warm layer reads `meta.jsonld` from hypergraph. Migration to Variant A (model-driven recall via search) as distillation trains search behavior.

**Transport pluggability:** `toolExecutor` callback in `createAgentLoop`. Local executor calls handlers directly. SSH/A2A executors serialize over the wire. Same tool code everywhere.

**Risk tags:** `workspace`, `crosses_boundary`, `inbound`, `outbound`, `irreversible`, `external_audience`. Empty/unknown → simulate+judge. Workspace-only → execute directly.

**Enterprise topology:** PM/orchestrator node manages infrastructure nodes via A2A. Seeds are ephemeral (generate node, then discard). Node identity is structural (constitution + modules + Agent Card). See `docs/MODNET-IMPLEMENTATION.md`.

## Open Questions

### Server + Agent Integration
```typescript
const agent = createAgentLoop({ model, tools, toolExecutor, constitution, goals, memoryPath })
const server = createServer({ trigger: agent.trigger, routes: { ...authRoutes, ...a2aRoutes }, validateSession })
```

### Model Lifecycle
- Loading/unloading at spawn, context window size discovery
- Fallback chain (API → local, frontier → reference)
- Health monitoring (latency, parse failures)

### Mid-Task Steering
- User intervention points in the 6-step loop
- Override semantics (does user approval override a gate block?)
- Teach mode (user corrections → GRPO preference pairs)

## CLI Tool Contract

Tools follow: JSON in (positional arg or stdin), JSON out (stdout), `--schema input|output`, `--help`, exit 0/1/2. Two factories in `cli.utils.ts`: `makeCli` (ToolHandler wrapper) and `parseCli` (custom execution).
