![Plaited sovereign agent node framework: sovereign nodes, A2A modnets, generative UI, and behavioral runtime provenance](assets/banner.svg)

**Sovereign agent nodes first. Framework details second.**

[![Build/Tests](https://github.com/plaited/plaited/actions/workflows/ci.yml/badge.svg)](https://github.com/plaited/plaited/actions/workflows/ci.yml)

---

Plaited is a framework for building local-first sovereign agents.

The current direction is:

- one agent per workspace
- a minimal behavioral core in `src/agent`
- factory-composed behavior for planning, memory, skills, MCP, A2A, and verification
- portable skills under `skills/` and workspace installs under `.agents/skills`
- a bootstrap CLI that turns infrastructure decisions into an executable setup surface

## Core Shape

Plaited's shipped runtime is centered on:

- [create-agent.ts](/Users/eirby/Workspace/plaited/src/agent/create-agent.ts)
- [behavioral.ts](/Users/eirby/Workspace/plaited/src/behavioral.ts)
- [bootstrap.ts](/Users/eirby/Workspace/plaited/src/bootstrap.ts)
- [improve.ts](/Users/eirby/Workspace/plaited/src/improve.ts)
- [ui.ts](/Users/eirby/Workspace/plaited/src/ui.ts)

The core owns:

- behavioral engine setup
- signal installation
- heartbeat and snapshot surfaces
- built-in file and inference handlers
- factory installation

Higher-level orchestration belongs in factories.

## Active Directions

- [AGENT-LOOP.md](/Users/eirby/Workspace/plaited/docs/AGENT-LOOP.md)
- [INFRASTRUCTURE.md](/Users/eirby/Workspace/plaited/docs/INFRASTRUCTURE.md)
- [default-factories/program.md](/Users/eirby/Workspace/plaited/dev-research/default-factories/program.md)
- [agent-bootstrap/program.md](/Users/eirby/Workspace/plaited/dev-research/agent-bootstrap/program.md)
- [three-axis-factories/program.md](/Users/eirby/Workspace/plaited/dev-research/three-axis-factories/program.md)
- [agent-harness-research/program.md](/Users/eirby/Workspace/plaited/dev-research/agent-harness-research/program.md)

## Repository Map

- [src/](/Users/eirby/Workspace/plaited/src/) — shipped framework code
- [skills/](/Users/eirby/Workspace/plaited/skills/) — published and reference skills
- [docs/](/Users/eirby/Workspace/plaited/docs/) — concise design docs
- [dev-research/](/Users/eirby/Workspace/plaited/dev-research/) — active program specs

Notable skill surfaces:

- [plaited-ui](/Users/eirby/Workspace/plaited/skills/plaited-ui/SKILL.md)
- [improve-workflows](/Users/eirby/Workspace/plaited/skills/improve-workflows/SKILL.md)

## Development

Requirements:

- [Bun](https://bun.sh/) `>= v1.2.9`
- `git`

Useful commands:

```bash
# Typecheck
bun --bun tsc --noEmit

# Full test suite
bun test

# Bootstrap a local deployment scaffold
bun run ./bin/plaited.ts bootstrap '{"targetDir":".","name":"my-agent"}'

# CLI schema discovery
bun run ./bin/plaited.ts --schema
```

## Skills

Skills are the portable agent-facing extension surface.

- published skills live under [skills/](/Users/eirby/Workspace/plaited/skills/)
- workspace-installed skills should live under `.agents/skills/`
- runtime composition still happens through factories

Factory-program fanout currently runs through the internal runner:

```bash
bun run program:factory run '{"programPath":"dev-research/skill-factories/program.md","attempts":3,"parallel":2}'
```
