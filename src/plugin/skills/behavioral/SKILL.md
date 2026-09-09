---
name: behavioral
description: >
  Behavioral-programming runtime and UI layer — b-threads, triggers,
  handlers, the controller/custom-element protocol, SSR/renderer, frontier
  analysis, behavioral eval capture, autoresearch hill-climbs, and OKF
  knowledge bundles. Use when creating, reading, updating, or deleting code
  where @behavioral/sh is a declared dependency or where the work is in the behavioral
  repo itself.
license: ISC
compatibility: Requires bun and the behavioral CLI
allowed-tools: Bash Read
---

# Behavioral Framework

Reference for an agent assisting an engineer working on the behavioral
behavioral-programming runtime and its UI layer. This skill routes you to
the right operator surface for the task. The detailed reference material
lives in `references/`; load it on demand per the route table below.

## When to use this skill

Use this skill when the task involves the behavioral **runtime** or **UI layer**
and you're working in a project where `@behavioral/sh` is a declared dependency or
in the behavioral repo itself. Specifically:

- Wiring **behavioral programs** — b-threads, triggers, handlers, the
  super-step model, deadlock/livelock analysis.
- Building **custom elements** via the controller protocol, or
  **server-side rendering** via the renderer.
- Capturing or grading **agent runs** (eval), or running **autoresearch**
  hill-climb loops over a behavioral agent.
- Authoring or validating **OKF knowledge bundles** (the Open Knowledge
  Format).
- Designing the **design-system spec** — a DESIGN.md derivative re-grounded
  on Structural IA, CSS custom properties, and `@scope`/`:host()`/`::part()`
  modes.

The `behavioral` CLI also ships `markdown`, `git-context`, and `typescript-lsp`
commands (registered in `bin/behavioral.ts`). They are general-purpose tools,
not framework-specific — run `behavioral <tool> --help` for usage.

## Route table

Read the reference that matches the task. Each is self-contained; load it
only when the task calls for it.

| When the task involves… | Read |
|-------------------------|------|
| Behavioral programs — b-threads, `useAddThread`/`useTrigger`/`useAddHandler`, the super-step model | [`references/behavioral.md`](./references/behavioral.md) |
| Deadlock/livelock verification — frontier analysis over the closed state graph | [`references/frontier-analysis.md`](./references/frontier-analysis.md) |
| Custom elements — the controller protocol, `render`/`attrs`, browser-side event dispatch | [`references/controller.md`](./references/controller.md) |
| Server-side rendering — the renderer layer, SSR, hydration | [`references/renderer.md`](./references/renderer.md) |
| Capturing/grading an agent run — eval trace primitives, divergence analysis | [`references/eval.md`](./references/eval.md) |
| Iterative hill-climb over a behavioral agent — autoresearch, mutation/selection loops | [`references/autoresearch.md`](./references/autoresearch.md) |
| OKF knowledge bundles — authoring, validation, §11 conformance, attested computations | [`references/okf.md`](./references/okf.md) |
| Design-system spec — DESIGN.md derivative, Structural IA, custom properties, `@scope`/`:host()`/`::part()`, scale + affordances/feedback (in-progress consensus surface) | [`references/design-spec.md`](./references/design-spec.md) |

## CLI tools shipped by behavioral

These commands are registered in `bin/behavioral.ts` and are not specific to
the behavioral runtime. Use `behavioral <tool> --help` for full usage:

- **`markdown`** — `behavioral markdown` (extract-links, validate-links,
  frontmatter). Used by the OKF reference for bundle-relative link validation.
- **`git-context`** — `behavioral git-context` (structured Git context before
  editing/committing).
- **`typescript-lsp`** — `behavioral typescript-lsp` (type-aware codebase
  analysis via LSP — hover, references, symbols). Used by the going-deeper
  workflow in several references below.
- **`mcp-client`** — `behavioral mcp-client` (discovering and calling remote
  MCP servers).

## Repo conventions

Follow `AGENTS.md` for repo conventions (Bun APIs, conventional commits,
file naming, no-index, minimal-implementation, testing). This skill routes
you to the right behavioral operator surface; `AGENTS.md` owns the workflow
rules.
