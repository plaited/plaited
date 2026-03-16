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
- `src/agent/` — `createAgentLoop()`, governance, gate, simulate, evaluate, context assembly (tiered hot/warm/cold), transport executors (local/SSH/A2A), branded factories, goal persistence, proactive heartbeat, snapshot writer, memory handlers, reingest handlers, ACP adapter
- `src/tools/` — CRUD handlers (with truncation, grep, scan-assisted edit, binary detection), trial/training/grader, hypergraph (WASM), ingestion CLI, LSP (with Bun.Transpiler scan), skill discovery with collision detection
- `src/a2a/` — HTTP + WebSocket bindings, push notifications, known-peers TOFU trust store, Agent Card JWS signing
- `src/modnet/` — node role constants, Agent Card metadata conventions

**What's next (see PROMPTS.md):**
- [ ] Phase 0: Cleanup (grader temp dirs, old package refs)
- [ ] Phase 1: Module workspace utils, server+agent integration (`createNode`), Model implementations
- [ ] Phase 2: MSS vocabulary skill, enriched modnet-node, trial adapters + eval persistence
- [ ] Phase 3: Module generation prompts (20, MiniAppBench-adapted), eval cycle, skill calibration
- [ ] Phase 4: SFT trajectory collection from frontier agents

## Key Decisions

**Model interface:** `Model.reason(context, signal) → AsyncIterable<ModelDelta>`. OpenAI-compatible wire format.

**Context management:** Tiered hot/warm/cold (Variant D → A migration via training).

**Transport pluggability:** `toolExecutor` callback. Local/SSH/A2A executors.

**Enterprise topology:** PM node + seeds. Node identity = constitution + modules + Agent Card. See `skills/modnet-node/`.

**Eval methodology:** MiniAppBench-adapted three dimensions (Intention × Static × Dynamic). Eval results persisted as JSONL in `.memory/evals/`, git-versioned. Generated artifacts ephemeral.

**Eval model mix:** Claude Opus for generation, Codex for inline grading, Gemini Flash for meta-verification.

## Open Questions

### Model Lifecycle
- Loading/unloading at spawn, context window size discovery
- Fallback chain (API → local, frontier → reference)

### Mid-Task Steering
- User intervention points in the 6-step loop
- Teach mode (user corrections → GRPO preference pairs)

## CLI Tool Contract

Tools follow: JSON in (positional arg or stdin), JSON out (stdout), `--schema input|output`, `--help`, exit 0/1/2. Two factories in `cli.utils.ts`: `makeCli` (ToolHandler wrapper) and `parseCli` (custom execution).
