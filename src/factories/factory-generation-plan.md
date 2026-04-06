# Factory Generation Plan

This file maps every program linked from
[dev-research/default-factories/program.md](../../dev-research/default-factories/program.md)
to a concrete `src/factories/*` target or an explicit non-factory note.

## Current State

- Shipped bootstrap bundle:
  [src/factories/default-factory-bundle/default-factory-bundle.ts](./default-factory-bundle/default-factory-bundle.ts)
  installs only
  [src/factories/server-factory/server-factory.ts](./server-factory/server-factory.ts).
- Concrete factory implementation today:
  [src/factories/server-factory/server-factory.ts](./server-factory/server-factory.ts).
- Existing but still placeholder factory surfaces:
  [src/factories/skills-factory/skills-factory.ts](./skills-factory/skills-factory.ts) and
  [src/factories/autoresearch-factory/autoresearch-factory.ts](./autoresearch-factory/autoresearch-factory.ts).
- Existing protocol utilities without a composing factory entry point:
  [src/factories/a2a-factory/](./a2a-factory/) and
  [src/factories/mcp-factory/](./mcp-factory/).

## Generation Rule

- Do not generate one placeholder file per lane.
- Generate factories in dependency order, starting with bootstrap policy
  surfaces that make later dynamic loading possible.
- Treat deployment-owned and runtime-loaded families as real factory targets,
  but do not promote them into the shipped bootstrap bundle until their
  neighboring lanes exist.

## Per-Program Map

- `skill-factories`
  Program: [dev-research/skill-factories/program.md](../../dev-research/skill-factories/program.md)
  Target: [src/factories/skills-factory/skills-factory.ts](./skills-factory/skills-factory.ts)
  Status: existing placeholder, implement next
  Install mode: bootstrap default candidate
  Notes: owns local skill discovery, selection policy, and context injection.

- `bash-factories`
  Program: [dev-research/bash-factories/program.md](../../dev-research/bash-factories/program.md)
  Target: `src/factories/bash-factory/bash-factory.ts`
  Status: new factory family
  Install mode: bootstrap default candidate
  Notes: wraps `AGENT_EVENTS.bash` with validation, routing, normalization, and observability.

- `acp-factories`
  Program: [dev-research/acp-factories/program.md](../../dev-research/acp-factories/program.md)
  Target: `src/factories/acp-factory/acp-factory.ts`
  Status: new factory family
  Install mode: deployment-provided or dynamic
  Notes: local control-plane operator surface, not a mandatory bootstrap default.

- `a2a-factories`
  Program: [dev-research/a2a-factories/program.md](../../dev-research/a2a-factories/program.md)
  Target: `src/factories/a2a-factory/a2a-factory.ts`
  Status: protocol utilities already exist, needs composition factory
  Install mode: deployment-provided or dynamic
  Notes: keep transport mechanics in the current directory and add a top-level policy factory.

- `mcp-factories`
  Program: [dev-research/mcp-factories/program.md](../../dev-research/mcp-factories/program.md)
  Target: `src/factories/mcp-factory/mcp-factory.ts`
  Status: protocol utilities already exist, needs composition factory
  Install mode: dynamic first, bootstrap candidate later
  Notes: compose manifest discovery, session reuse, auth, retries, and capability projection.

- `memory-factories`
  Program: [dev-research/memory-factories/program.md](../../dev-research/memory-factories/program.md)
  Target: `src/factories/memory-factory/memory-factory.ts`
  Status: new factory family
  Install mode: dynamic first
  Notes: depends on observability, projection, and context-assembly decisions.

- `search-factories`
  Program: [dev-research/search-factories/program.md](../../dev-research/search-factories/program.md)
  Target: `src/factories/search-factory/search-factory.ts`
  Status: new factory family
  Install mode: bootstrap default candidate
  Notes: unifies internal repo search, skill search, module search, and external search routing.

- `verification-factories`
  Program: [dev-research/verification-factories/program.md](../../dev-research/verification-factories/program.md)
  Target: `src/factories/verification-factory/verification-factory.ts`
  Status: new factory family
  Install mode: bootstrap default candidate
  Notes: deterministic checks, simulation, repair routing, and retained verification artifacts.

- `three-axis-factories`
  Program: [dev-research/three-axis-factories/program.md](../../dev-research/three-axis-factories/program.md)
  Target: `src/factories/three-axis-factory/three-axis-factory.ts`
  Status: new cross-cutting factory family
  Install mode: bootstrap or deployment overlay
  Notes: capability, autonomy, and authority control layer above capability factories.

- `node-auth-factories`
  Program: [dev-research/node-auth-factories/program.md](../../dev-research/node-auth-factories/program.md)
  Target: `src/factories/node-auth-factory/node-auth-factory.ts`
  Status: new factory family
  Install mode: deployment-provided bootstrap overlay
  Notes: shape exposure and authority from auth mode without moving auth policy into the core.

- `server-factory`
  Program: [dev-research/server-factory/program.md](../../dev-research/server-factory/program.md)
  Target: [src/factories/server-factory/server-factory.ts](./server-factory/server-factory.ts)
  Status: implemented
  Install mode: shipped bootstrap default
  Notes: keep as the minimal runtime transport bridge.

- `module-discovery-factories`
  Program: [dev-research/module-discovery-factories/program.md](../../dev-research/module-discovery-factories/program.md)
  Target: `src/factories/module-discovery-factory/module-discovery-factory.ts`
  Status: new factory family
  Install mode: bootstrap default candidate
  Notes: one of the first factories to add because dynamic module loading depends on it.

- `plan-factories`
  Program: [dev-research/plan-factories/program.md](../../dev-research/plan-factories/program.md)
  Target: `src/factories/plan-factory/plan-factory.ts`
  Status: new factory family
  Install mode: bootstrap default candidate
  Notes: decomposition, step routing, and plan-state policy.

- `edit-factories`
  Program: [dev-research/edit-factories/program.md](../../dev-research/edit-factories/program.md)
  Target: `src/factories/edit-factory/edit-factory.ts`
  Status: new factory family
  Install mode: bootstrap candidate after plan and verification
  Notes: edit strategy, patch routing, and edit-state policy.

- `node-home-factories`
  Program: [dev-research/node-home-factories/program.md](../../dev-research/node-home-factories/program.md)
  Target: `src/factories/node-home-factory/node-home-factory.ts`
  Status: new factory family
  Install mode: deployment-provided bootstrap overlay
  Notes: durable node-home policy, promotion semantics, and host handoff state.

- `node-discovery-factories`
  Program: [dev-research/node-discovery-factories/program.md](../../dev-research/node-discovery-factories/program.md)
  Target: `src/factories/node-discovery-factory/node-discovery-factory.ts`
  Status: new factory family
  Install mode: deployment-provided or dynamic
  Notes: stable public identity, publication policy, and rebind behavior across hosts.

- `notification-factories`
  Program: [dev-research/notification-factories/program.md](../../dev-research/notification-factories/program.md)
  Target: `src/factories/notification-factory/notification-factory.ts`
  Status: new factory family
  Install mode: bootstrap default candidate
  Notes: explicit attention routing for important runtime events.

- `observability-factories`
  Program: [dev-research/observability-factories/program.md](../../dev-research/observability-factories/program.md)
  Target: `src/factories/observability-factory/observability-factory.ts`
  Status: new factory family
  Install mode: bootstrap default candidate
  Notes: retained traces, artifact schemas, replayability, and inspection quality.

- `projection-factories`
  Program: [dev-research/projection-factories/program.md](../../dev-research/projection-factories/program.md)
  Target: `src/factories/projection-factory/projection-factory.ts`
  Status: new factory family
  Install mode: bootstrap default candidate
  Notes: bounded context blocks derived from richer retained state.

- `workflow-state-factories`
  Program: [dev-research/workflow-state-factories/program.md](../../dev-research/workflow-state-factories/program.md)
  Target: `src/factories/workflow-state-factory/workflow-state-factory.ts`
  Status: new factory family
  Install mode: bootstrap candidate
  Notes: in-process role coordination through shared events, signals, and overlays.

- `session-persistence-factories`
  Program: [dev-research/session-persistence-factories/program.md](../../dev-research/session-persistence-factories/program.md)
  Target: `src/factories/session-persistence-factory/session-persistence-factory.ts`
  Status: new factory family
  Install mode: deployment-provided bootstrap overlay
  Notes: restart continuity, replay artifacts, and partial-output recovery.

- `tool-registry-factories`
  Program: [dev-research/tool-registry-factories/program.md](../../dev-research/tool-registry-factories/program.md)
  Target: `src/factories/tool-registry-factory/tool-registry-factory.ts`
  Status: new factory family
  Install mode: bootstrap default candidate
  Notes: compact capability registry for built-ins, skills, MCP, A2A, and future modules.

- `permission-audit-factories`
  Program: [dev-research/permission-audit-factories/program.md](../../dev-research/permission-audit-factories/program.md)
  Target: `src/factories/permission-audit-factory/permission-audit-factory.ts`
  Status: new factory family
  Install mode: deployment or persistent local profile
  Notes: durable approval, denial, revocation, and authority-transition audit ledger.

- `context-assembly-factories`
  Program: [dev-research/context-assembly-factories/program.md](../../dev-research/context-assembly-factories/program.md)
  Target: `src/factories/context-assembly-factory/context-assembly-factory.ts`
  Status: new factory family
  Install mode: bootstrap default candidate
  Notes: phase-aware bounded request construction across memory, search, projection, and tool selection.

- `fanout-factories`
  Program: [dev-research/fanout-factories/program.md](../../dev-research/fanout-factories/program.md)
  Target: `src/factories/fanout-factory/fanout-factory.ts`
  Status: new factory family
  Install mode: dynamic or optional bootstrap overlay
  Notes: bounded multi-attempt execution with durable worktree-backed artifacts.

- `identity-trust-factories`
  Program: [dev-research/identity-trust-factories/program.md](../../dev-research/identity-trust-factories/program.md)
  Target: `src/factories/identity-trust-factory/identity-trust-factory.ts`
  Status: new factory family
  Install mode: deployment-provided or dynamic
  Notes: stable node identity, peer trust, credential verification, and optional SSI-backed trust services.

- `agent-bootstrap`
  Program: [dev-research/agent-bootstrap/program.md](../../dev-research/agent-bootstrap/program.md)
  Target: no `src/factories/*` target
  Status: supporting infrastructure program
  Install mode: not a factory
  Notes: owns `src/bootstrap/*` and the `plaited bootstrap` operator surface.

- `agent-harness-research`
  Program: [dev-research/agent-harness-research/program.md](../../dev-research/agent-harness-research/program.md)
  Target: no `src/factories/*` target
  Status: supporting research program
  Install mode: not a factory
  Notes: owns lane search, promotion evidence, and later training artifact retention.

## Recommended Generation Waves

- Wave 1: fill concrete bootstrap gaps
  `skills-factory`, `module-discovery-factory`, `tool-registry-factory`,
  `search-factory`, `plan-factory`, `projection-factory`,
  `notification-factory`, `observability-factory`, `verification-factory`
- Wave 2: add execution and protocol composition
  `bash-factory`, `edit-factory`, `workflow-state-factory`,
  `a2a-factory`, `mcp-factory`, `node-auth-factory`,
  `three-axis-factory`
- Wave 3: add persistence and host identity layers
  `memory-factory`, `session-persistence-factory`,
  `node-home-factory`, `node-discovery-factory`,
  `permission-audit-factory`, `identity-trust-factory`
- Wave 4: add optional advanced operator and scale surfaces
  `acp-factory`, `fanout-factory`

## First Promotion Candidate

After `server-factory`, the best next bootstrap bundle candidate is:

- `skills-factory`
- `module-discovery-factory`
- `tool-registry-factory`
- `search-factory`
- `plan-factory`
- `projection-factory`
- `notification-factory`
- `observability-factory`
- `verification-factory`

That set matches the umbrella lane's current goal more closely than creating
networking, identity, or persistence overlays first.
