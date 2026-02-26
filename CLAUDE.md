@AGENTS.md

## Testing

**Always use `bun test src/`** — never bare `bun test`. The `skills/` directory contains copied test assets with broken module paths that are not meant to be tested directly. The `package.json` `test` script scopes tests to `src/` only.

## Greenfield Mindset

This is **greenfield code with zero external consumers**. There are no backward-compatibility concerns. Each wave refines the architecture — don't preserve patterns or APIs "just in case." If something is unused, delete it. If a simpler approach exists, use it. The only constraint is not modifying `src/behavioral/` or `src/ui/` without explicit approval.

## BP-First Architecture Principles

When working on `src/agent/`, these patterns were hard-won across 7 waves:

1. **Silent block ≠ coordination.** A blocked event vanishes in BP. If another thread counts that event (e.g., `batchCompletion`), the system deadlocks. Always pair blocking bThreads with handler-level checks that produce rejection events. bThread = defense-in-depth, handler = workflow coordination + model feedback.

2. **Pipeline pass-through > conditional bypass.** Events should flow through the full simulate → evaluate → execute pipeline. When a seam is absent, the handler passes through — don't short-circuit routing with `if (!seam)` conditionals. Adding/removing seams shouldn't change routing logic.

3. **Thin handlers, structural coordination.** Handlers do ONE thing (call a seam, parse data, push to history). Routing and lifecycle belong in bThreads. If you're writing `if/else` in a handler to decide which event to trigger next, consider whether a bThread should handle that coordination.

4. **Exhaustive type maps fight additive composition.** `Handlers<T>` mapped types force noop stubs for unused events. Use unparameterized `behavioral()` — handlers self-validate with Zod at boundaries. BP is additive: wire up what you need, ignore the rest.

5. **No backward compatibility for greenfield.** Don't create abstraction layers, feature flags, or three-level approaches for hypothetical future consumers. Always-full is simpler than configurable.

## Active Work Context

### Agent Framework Build (feat/agent-loop-build branch)

When working on `src/agent/` files, activate the **agent-build** skill — it contains the wave architecture, BP coordination patterns, event flow, and implementation context.

**Current status — 7 waves complete:**
- Waves 1–6: Tool executor, gate, simulate, evaluate, memory, orchestrator, constitution
- Wave 7: BP-first architecture (unparameterized behavioral(), pipeline pass-through, dual-layer symbolic safety, full snapshot context)

**1151 total tests passing** across 79 files.

**Outstanding issues** (see `docs/WAVE-LOG.md` for details):
- Orchestrator IPC handler replacement is fragile (`agent.orchestrator.ts`)
- LSP semantic search pipeline + `searchGate` bThread never built (Wave 3 partial)
