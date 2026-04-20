# Agent Runtime Notes

This note captures source-aligned runtime guidance distilled from active docs
(`ARCHITECTURE.md`, `AGENT-LOOP.md`) and current source.

## Stable Runtime Shape

- Minimal core in `src/agent/create-agent.ts`.
- Behavioral runtime as coordination substrate.
- Module-composed orchestration over a narrow core surface.
- Snapshot-first observability for runtime and extension diagnostics.

## Current Active Contracts

- Core event ingress/handlers and dynamic extension install remain in the agent
  core.
- Runtime actor extensions under `src/modules` handle websocket ingress,
  transport checks, and forwarding into extension request flows.
- The two-model inference direction is architectural context and currently
  represented through the inference websocket runtime actor/server lane.

## Authority Rule

When docs conflict with `src/` code/tests, code/tests are authoritative.

Treat these as non-normative for runtime contract naming unless source-backed:
- deployment-target documents (for example `INFRASTRUCTURE.md`)
- hypothetical research docs (for example `hypothetical-architecture.md`)
