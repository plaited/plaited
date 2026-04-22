# Agent Runtime Notes

This note captures source-aligned runtime guidance distilled from active wiki
pages (`docs/wiki/architecture.md`, `docs/wiki/agent-loop.md`) and current
source.

## Stable Runtime Shape

- Minimal core in `src/agent/create-agent.ts`.
- Behavioral runtime as coordination substrate.
- Module-composed orchestration over a narrow core surface.
- Snapshot-first observability for runtime and extension diagnostics.

## Current Active Contracts

- Core event ingress/handlers and dynamic extension install remain in the agent
  core.
- Runtime actor extensions under `src/modules` handle current websocket
  ingress, transport checks, and forwarding into extension request flows.
- The two-model inference direction is architectural context. Current source
  represents inference transport through the inference websocket runtime
  actor/server lane; the target same-machine local bridge is documented as a
  Unix socket framed `ActorEnvelope` stream in
  `docs/wiki/local-inference-bridge.md`.

## Authority Rule

When docs conflict with `src/` code/tests, code/tests are authoritative.

Treat these as non-normative for runtime contract naming unless source-backed:
- deployment-target wiki pages such as `docs/wiki/infrastructure.md`
- architecture-decision wiki pages whose implementation gaps are explicit
