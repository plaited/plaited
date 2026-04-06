# Module Generation Plan

This file maps every program linked from
[dev-research/default-modules/program.md](../../dev-research/default-modules/program.md)
to a concrete `src/modules/*` target or an explicit non-module note.

## Current State

- Shipped bootstrap bundle:
  [src/modules/default-module-bundle/default-module-bundle.ts](./default-module-bundle/default-module-bundle.ts)
  installs only
  [src/modules/server-module/server-module.ts](./server-module/server-module.ts).
- Concrete module implementation today:
  [src/modules/server-module/server-module.ts](./server-module/server-module.ts).
- Existing but still placeholder module surfaces:
  [src/modules/skills-module/skills-module.ts](./skills-module/skills-module.ts) and
  [src/modules/autoresearch-module/autoresearch-module.ts](./autoresearch-module/autoresearch-module.ts).
- Existing protocol utilities without a composing module entry point:
  [src/modules/a2a-module/](./a2a-module/) and
  [src/modules/mcp-module/](./mcp-module/).

## Generation Rule

- Do not generate one placeholder file per lane.
- Generate modules in dependency order, starting with bootstrap policy
  surfaces that make later dynamic loading possible.
- Treat deployment-owned and runtime-loaded families as real module targets,
  but do not promote them into the shipped bootstrap bundle until their
  neighboring lanes exist.

## Per-Program Map

- `skill-modules`
  Program: [dev-research/skill-modules/program.md](../../dev-research/skill-modules/program.md)
  Target: [src/modules/skills-module/skills-module.ts](./skills-module/skills-module.ts)
  Status: existing placeholder, implement next
  Install mode: bootstrap default candidate
  Notes: owns local skill discovery, selection policy, and context injection.

- `bash-modules`
  Program: [dev-research/bash-modules/program.md](../../dev-research/bash-modules/program.md)
  Target: `src/modules/bash-module/bash-module.ts`
  Status: new module family
  Install mode: bootstrap default candidate
  Notes: wraps `AGENT_EVENTS.bash` with validation, routing, normalization, and observability.

- `acp-modules`
  Program: [dev-research/acp-modules/program.md](../../dev-research/acp-modules/program.md)
  Target: `src/modules/acp-module/acp-module.ts`
  Status: new module family
  Install mode: deployment-provided or dynamic
  Notes: local control-plane operator surface, not a mandatory bootstrap default.

- `a2a-modules`
  Program: [dev-research/a2a-modules/program.md](../../dev-research/a2a-modules/program.md)
  Target: `src/modules/a2a-module/a2a-module.ts`
  Status: protocol utilities already exist, needs composition module
  Install mode: deployment-provided or dynamic
  Notes: keep transport mechanics in the current directory and add a top-level policy module.

- `mcp-modules`
  Program: [dev-research/mcp-modules/program.md](../../dev-research/mcp-modules/program.md)
  Target: `src/modules/mcp-module/mcp-module.ts`
  Status: protocol utilities already exist, needs composition module
  Install mode: dynamic first, bootstrap candidate later
  Notes: compose manifest discovery, session reuse, auth, retries, and capability projection.

- `memory-modules`
  Program: [dev-research/memory-modules/program.md](../../dev-research/memory-modules/program.md)
  Target: `src/modules/memory-module/memory-module.ts`
  Status: new module family
  Install mode: dynamic first
  Notes: depends on observability, projection, and context-assembly decisions.

- `search-modules`
  Program: [dev-research/search-modules/program.md](../../dev-research/search-modules/program.md)
  Target: `src/modules/search-module/search-module.ts`
  Status: new module family
  Install mode: bootstrap default candidate
  Notes: unifies internal repo search, skill search, module search, and external search routing.

- `verification-modules`
  Program: [dev-research/verification-modules/program.md](../../dev-research/verification-modules/program.md)
  Target: `src/modules/verification-module/verification-module.ts`
  Status: new module family
  Install mode: bootstrap default candidate
  Notes: deterministic checks, simulation, repair routing, and retained verification artifacts.

- `three-axis-modules`
  Program: [dev-research/three-axis-modules/program.md](../../dev-research/three-axis-modules/program.md)
  Target: `src/modules/three-axis-module/three-axis-module.ts`
  Status: new cross-cutting module family
  Install mode: bootstrap or deployment overlay
  Notes: capability, autonomy, and authority control layer above capability modules.

- `node-auth-modules`
  Program: [dev-research/node-auth-modules/program.md](../../dev-research/node-auth-modules/program.md)
  Target: `src/modules/node-auth-module/node-auth-module.ts`
  Status: new module family
  Install mode: deployment-provided bootstrap overlay
  Notes: shape exposure and authority from auth mode without moving auth policy into the core.

- `server-module`
  Program: [dev-research/server-module/program.md](../../dev-research/server-module/program.md)
  Target: [src/modules/server-module/server-module.ts](./server-module/server-module.ts)
  Status: implemented
  Install mode: shipped bootstrap default
  Notes: keep as the minimal runtime transport bridge.

- `module-discovery-modules`
  Program: [dev-research/module-discovery-modules/program.md](../../dev-research/module-discovery-modules/program.md)
  Target: `src/modules/module-discovery-module/module-discovery-module.ts`
  Status: new module family
  Install mode: bootstrap default candidate
  Notes: one of the first modules to add because dynamic module loading depends on it.

- `plan-modules`
  Program: [dev-research/plan-modules/program.md](../../dev-research/plan-modules/program.md)
  Target: `src/modules/plan-module/plan-module.ts`
  Status: new module family
  Install mode: bootstrap default candidate
  Notes: decomposition, step routing, and plan-state policy.

- `edit-modules`
  Program: [dev-research/edit-modules/program.md](../../dev-research/edit-modules/program.md)
  Target: `src/modules/edit-module/edit-module.ts`
  Status: new module family
  Install mode: bootstrap candidate after plan and verification
  Notes: edit strategy, patch routing, and edit-state policy.

- `node-home-modules`
  Program: [dev-research/node-home-modules/program.md](../../dev-research/node-home-modules/program.md)
  Target: `src/modules/node-home-module/node-home-module.ts`
  Status: new module family
  Install mode: deployment-provided bootstrap overlay
  Notes: durable node-home policy, promotion semantics, and host handoff state.

- `node-discovery-modules`
  Program: [dev-research/node-discovery-modules/program.md](../../dev-research/node-discovery-modules/program.md)
  Target: `src/modules/node-discovery-module/node-discovery-module.ts`
  Status: new module family
  Install mode: deployment-provided or dynamic
  Notes: stable public identity, publication policy, and rebind behavior across hosts.

- `notification-modules`
  Program: [dev-research/notification-modules/program.md](../../dev-research/notification-modules/program.md)
  Target: `src/modules/notification-module/notification-module.ts`
  Status: new module family
  Install mode: bootstrap default candidate
  Notes: explicit attention routing for important runtime events.

- `observability-modules`
  Program: [dev-research/observability-modules/program.md](../../dev-research/observability-modules/program.md)
  Target: `src/modules/observability-module/observability-module.ts`
  Status: new module family
  Install mode: bootstrap default candidate
  Notes: retained traces, artifact schemas, replayability, and inspection quality.

- `projection-modules`
  Program: [dev-research/projection-modules/program.md](../../dev-research/projection-modules/program.md)
  Target: `src/modules/projection-module/projection-module.ts`
  Status: new module family
  Install mode: bootstrap default candidate
  Notes: bounded context blocks derived from richer retained state.

- `workflow-state-modules`
  Program: [dev-research/workflow-state-modules/program.md](../../dev-research/workflow-state-modules/program.md)
  Target: `src/modules/workflow-state-module/workflow-state-module.ts`
  Status: new module family
  Install mode: bootstrap candidate
  Notes: in-process role coordination through shared events, signals, and overlays.

- `session-persistence-modules`
  Program: [dev-research/session-persistence-modules/program.md](../../dev-research/session-persistence-modules/program.md)
  Target: `src/modules/session-persistence-module/session-persistence-module.ts`
  Status: new module family
  Install mode: deployment-provided bootstrap overlay
  Notes: restart continuity, replay artifacts, and partial-output recovery.

- `tool-registry-modules`
  Program: [dev-research/tool-registry-modules/program.md](../../dev-research/tool-registry-modules/program.md)
  Target: `src/modules/tool-registry-module/tool-registry-module.ts`
  Status: new module family
  Install mode: bootstrap default candidate
  Notes: compact capability registry for built-ins, skills, MCP, A2A, and future modules.

- `permission-audit-modules`
  Program: [dev-research/permission-audit-modules/program.md](../../dev-research/permission-audit-modules/program.md)
  Target: `src/modules/permission-audit-module/permission-audit-module.ts`
  Status: new module family
  Install mode: deployment or persistent local profile
  Notes: durable approval, denial, revocation, and authority-transition audit ledger.

- `context-assembly-modules`
  Program: [dev-research/context-assembly-modules/program.md](../../dev-research/context-assembly-modules/program.md)
  Target: `src/modules/context-assembly-module/context-assembly-module.ts`
  Status: new module family
  Install mode: bootstrap default candidate
  Notes: phase-aware bounded request construction across memory, search, projection, and tool selection.

- `fanout-modules`
  Program: [dev-research/fanout-modules/program.md](../../dev-research/fanout-modules/program.md)
  Target: `src/modules/fanout-module/fanout-module.ts`
  Status: new module family
  Install mode: dynamic or optional bootstrap overlay
  Notes: bounded multi-attempt execution with durable worktree-backed artifacts.

- `identity-trust-modules`
  Program: [dev-research/identity-trust-modules/program.md](../../dev-research/identity-trust-modules/program.md)
  Target: `src/modules/identity-trust-module/identity-trust-module.ts`
  Status: new module family
  Install mode: deployment-provided or dynamic
  Notes: stable node identity, peer trust, credential verification, and optional SSI-backed trust services.

- `agent-bootstrap`
  Program: [dev-research/agent-bootstrap/program.md](../../dev-research/agent-bootstrap/program.md)
  Target: no `src/modules/*` target
  Status: supporting infrastructure program
  Install mode: not a module
  Notes: owns `src/bootstrap/*` and the `plaited bootstrap` operator surface.

- `agent-harness-research`
  Program: [dev-research/agent-harness-research/program.md](../../dev-research/agent-harness-research/program.md)
  Target: no `src/modules/*` target
  Status: supporting research program
  Install mode: not a module
  Notes: owns lane search, promotion evidence, and later training artifact retention.

## Recommended Generation Waves

- Wave 1: fill concrete bootstrap gaps
  `skills-module`, `module-discovery-module`, `tool-registry-module`,
  `search-module`, `plan-module`, `projection-module`,
  `notification-module`, `observability-module`, `verification-module`
- Wave 2: add execution and protocol composition
  `bash-module`, `edit-module`, `workflow-state-module`,
  `a2a-module`, `mcp-module`, `node-auth-module`,
  `three-axis-module`
- Wave 3: add persistence and host identity layers
  `memory-module`, `session-persistence-module`,
  `node-home-module`, `node-discovery-module`,
  `permission-audit-module`, `identity-trust-module`
- Wave 4: add optional advanced operator and scale surfaces
  `acp-module`, `fanout-module`

## First Promotion Candidate

After `server-module`, the best next bootstrap bundle candidate is:

- `skills-module`
- `module-discovery-module`
- `tool-registry-module`
- `search-module`
- `plan-module`
- `projection-module`
- `notification-module`
- `observability-module`
- `verification-module`

That set matches the umbrella lane's current goal more closely than creating
networking, identity, or persistence overlays first.
