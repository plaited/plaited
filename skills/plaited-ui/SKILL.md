---
name: plaited-ui
description: Build and test Plaited's server-driven UI stack. Use when working on `src/ui`, the controller protocol, custom elements, dynamic behavioral loading, SSR, or the UI test strategy.
license: ISC
compatibility: Requires bun, @playwright/cli, @happy-dom/global-registrator
---

# Plaited UI

## Purpose

This skill is the unified entrypoint for Plaited's UI stack.

Use it when you need to:

- build or change `src/ui/`
- work on server-driven rendering through the controller protocol
- design `controlIsland`, `controlDocument`, or `decorateElements` flows
- add dynamic client behavior through `update_behavioral`
- test UI behavior from schema-level checks up through real browser flows

**Prerequisite:** use `behavioral-core` when the change depends on BP semantics
rather than the UI surface itself.

## Structural Overview

`src/ui/` is split into four subsystems:

| Subsystem | Key APIs | Primary Reference |
|---|---|---|
| Rendering pipeline | `createTemplate` / `h`, `Fragment`, `createSSR` | `references/server-pipeline.md` |
| CSS system | `createStyles`, `createTokens`, `createHostStyles`, `createKeyframes`, `joinStyles` | `references/css-system.md` |
| DOM/custom elements | `controlIsland`, `controlDocument`, `decorateElements`, `DelegatedListener` | This skill + `references/server-pipeline.md` |
| Controller protocol | `render`, `attrs`, `update_behavioral`, `disconnect`, `user_action`, `snapshot` | `references/update-behavioral.md`, `references/websocket-decisions.md` |

Public UI exports are re-exported through `src/ui.ts`.

## Quick Start

1. Start from the protocol and rendering shape, not ad hoc DOM mutation.
2. Use `p-target` for server-addressable update points.
3. Use `p-trigger` for browser-to-server event wiring.
4. Use `update_behavioral` for post-load client logic.
5. Pick the smallest test layer that matches the change.

## Rendering Model

Plaited UI is server-driven:

- the server/agent produces JSX templates
- `createSSR()` turns templates into HTML strings
- the browser controller applies `render` and `attrs` messages
- BP coordinates client behavior and snapshot reporting

Important rules:

- JSX produces template objects, not DOM nodes
- styles are collected at template creation time and deduplicated per connection
- inline event handlers are not the pattern here; use `p-trigger`
- dynamically rendered `<script>` tags do not execute
- `update_behavioral` is the supported path for loading new client logic

## Dynamic Behavioral Loading

`update_behavioral` is the UI system's runtime code-loading boundary.

The flow is:

1. server sends a module URL
2. client `import(url)` loads it
3. the module's default factory receives `restrictedTrigger`
4. returned `threads` and `handlers` are validated and merged into the BP engine

Loaded modules can participate in rendering and local coordination, but they
cannot directly fire blocked client/server lifecycle events.

See:

- `references/update-behavioral.md`
- `references/websocket-decisions.md`

## Testing Strategy

Use three layers:

| Layer | Use For | Runner |
|---|---|---|
| Pure function | schemas, constants, transforms, CSS utilities | `bun test` |
| DOM unit | custom element registration, factory return shape, template structure | `bun test` with happy-dom |
| Real browser | WebSocket roundtrips, swap behavior, dynamic imports, real DOM mutation | `@playwright/cli` |

Rules:

- do not append control islands to happy-dom DOM trees
- use real browser tests for WebSocket and dynamic import behavior
- prefer fixture servers over brittle mock-WebSocket stacks
- keep protocol/schema checks in pure tests when possible

See `references/testing.md` for the detailed testing patterns.

## When To Open References

- `references/server-pipeline.md`
  Use when changing SSR output, template behavior, style injection, or light/shadow DOM handoff.
- `references/css-system.md`
  Use when changing styling helpers or token behavior.
- `references/update-behavioral.md`
  Use when changing dynamic behavioral loading or its validation/security model.
- `references/websocket-decisions.md`
  Use when changing protocol transport, session, replay, CSP, or origin rules.
- `references/testing.md`
  Use when adding or revising UI tests.

## Related Skills

- `behavioral-core` for BP semantics and thread design
- `code-documentation` for TSDoc work in `src/ui`
