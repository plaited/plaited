![Plaited sovereign agent node framework: sovereign nodes, A2A modnets, generative UI, and behavioral runtime provenance](assets/banner.svg)

**Sovereign agent nodes first. Framework details second.**

[![Build/Tests](https://github.com/plaited/plaited/actions/workflows/ci.yml/badge.svg)](https://github.com/plaited/plaited/actions/workflows/ci.yml)

---

Plaited is a framework for building local-first sovereign agents.

The current direction is:

- one agent per workspace
- a minimal behavioral core in `src/agent`
- module-composed behavior for planning, memory, skills, MCP, A2A, and verification
- portable skills under `skills/` and workspace installs under `.agents/skills`
- a bootstrap CLI that turns infrastructure decisions into an executable setup surface

## Core Shape

Plaited's shipped runtime is centered on:

- [create-agent.ts](/Users/eirby/Workspace/plaited/src/agent/create-agent.ts)
- [behavioral.ts](/Users/eirby/Workspace/plaited/src/behavioral.ts)
- [plaited.ts](/Users/eirby/Workspace/plaited/bin/plaited.ts)
- [eval.ts](/Users/eirby/Workspace/plaited/src/eval.ts)
- [research.cli.ts](/Users/eirby/Workspace/plaited/src/research/research.cli.ts)
- [ui.ts](/Users/eirby/Workspace/plaited/src/ui.ts)

The core owns:

- behavioral engine setup
- signal installation
- heartbeat and snapshot surfaces
- built-in file and inference handlers
- module installation

Higher-level orchestration belongs in modules.

## Active Directions

- [docs/wiki/index.md](/Users/eirby/Workspace/plaited/docs/wiki/index.md)
- [docs/wiki/architecture.md](/Users/eirby/Workspace/plaited/docs/wiki/architecture.md)
- [docs/wiki/agent-loop.md](/Users/eirby/Workspace/plaited/docs/wiki/agent-loop.md)
- [docs/wiki/actor-runtime.md](/Users/eirby/Workspace/plaited/docs/wiki/actor-runtime.md)
- [docs/wiki/local-inference-bridge.md](/Users/eirby/Workspace/plaited/docs/wiki/local-inference-bridge.md)
- [dev-research/README.md](/Users/eirby/Workspace/plaited/dev-research/README.md)

## Repository Map

- `src/` — shipped framework code
- `skills/` — published and reference skills
- `docs/` — wiki-first documentation
- `dev-research/` — retired research tombstone and historical artifacts

Notable skill surfaces:

- [plaited-ui](/Users/eirby/Workspace/plaited/skills/plaited-ui/SKILL.md)

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

- published skills live under `skills/`
- workspace-installed skills should live under `.agents/skills/`
- runtime composition still happens through modules

Repo planning is prompt-driven and maintainer-reviewed. Agent-authored work should start from
fresh `origin/dev` worktrees unless the task says otherwise.
