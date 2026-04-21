# The Agent Loop

> **Status: ACTIVE** — Architecture note for the minimal agent core and
> module-composed orchestration model. Cross-references: `ARCHITECTURE.md`
> (top-level system shape), `INFRASTRUCTURE.md` (deployment/runtime
> boundaries), `dev-research/README.md` (retired local lanes plus active issue
> backlog links), `skills/plaited-runtime/` (runtime doctrine and MSS/module framing).

## Overview

Plaited treats the agent loop as a minimal core plus an installed module
bundle.

The current architecture splits the system into:

1. a **minimal core** in `src/agent/create-agent.ts`
2. a set of **installed modules** that add planning, memory, skills, MCP,
   A2A, verification, and other orchestration layers

That means the active question is not "what does the built-in loop do?" It is
"which module bundle is installed, and what orchestration does that bundle
compose on top of the core?"

## Minimal Core

`createAgent()` owns only a small execution substrate:

- `behavioral()` engine setup
- host `trigger` ingress
- module `emit` ingress
- event-derived context memory (`eventType` -> last selected detail)
- heartbeat ingress
- guarded bash execution through the execution process actor
- actor directory scanning
- snapshot access through `useSnapshot`
- host/runtime diagnostic publishing through `reportSnapshot`

The core is intentionally narrow. It does not define a canonical planning,
memory, simulation, judge, or context-assembly policy.

## Core Surface

The built-in core event surface is:

- `actors_scan`
- `bash`
- `heartbeat`
- `tool_bash_request`
- `tool_bash_approved`
- `tool_bash_denied`
- `tool_bash_result`

These are engine-level primitives. They are not the full user-facing loop.

## Module-Composed Orchestration

Modules receive:

- `moduleId`
- `emit`
- `last(listener)`
- `addThreads(threads)` (scoped by declared module name, fallback `moduleId`)
- `useSnapshot`

From those seams they can install:

- static `threads` (installed through the same scoped thread helper)
- dynamic scoped threads via `addThreads(...)`
- feedback handlers
- runtime policy

This is where higher-level loop behavior should now live.

Runtime/module install diagnostics should be published as snapshot messages
(for example `module_warning`) so they appear in the same observability stream
as selection/deadlock/feedback snapshots.

Examples:

- a `memory-module` can assemble retained context from snapshots and durable
  memory
- a `plan-module` can own plan generation, current-plan state, and re-planning
  rules
- a `skills-module` can expose a searchable catalog of skills and inject a
  selected skill body into model context
- an `mcp-module` can expose a searchable remote capability inventory without
  stuffing full tool schemas into the prompt
- an `a2a-module` can project remote agent capabilities and routing policy
- a `verification-module` can run symbolic or neural checks before allowing
  side effects
- an `edit-module` can orchestrate `read_file` -> `models.primary` ->
  `write_file` as a higher-level editing primitive

## Context Assembly

Context assembly should be treated as a composed module responsibility, not a
core invariant.

Likely contributors include:

- recent task or conversation state
- retained working and episodic memory
- current plan state
- selected skill metadata or body
- searchable MCP capability results
- prior verification failures or repair hints
- governance or verification constraints from installed modules

Different module bundles may assemble context differently while still using
the same minimal engine underneath.

## Tools

The core currently provides low-level execution primitives, not a final
end-user tool UX.

### Built-In Primitives

| Primitive | Purpose |
|---|---|
| `actors_scan` | Scan a workspace actor directory and install default actor exports |
| `heartbeat` | Host-provided pulse for module-owned orchestration |
| `tool_bash_request` | Request guarded workspace-local process execution |
| `tool_bash_approved` | Approve a pending guarded process request |
| `tool_bash_denied` | Deny a pending guarded process request |
| `tool_bash_result` | Publish process completion, failure, and captured output |
| `bash` | Internal normalized execution event after approval |

### Higher-Level Tools

Higher-level tools should usually be module-owned compositions.

Examples:

- `edit_file` should be a small orchestration layer rather than a core
  primitive
- planning tools should come from a `plan-module`
- skill selection and activation should come from `skills-module`
- MCP discovery and tool routing should come from `mcp-module`

## Heartbeat

The heartbeat is a core capability, but its meaning is module-defined.

The host emits `heartbeat`, for example from `Bun.cron`, by calling the
`trigger` returned from `createAgent()`. Modules can use that event for:

- proactive sensing
- background maintenance
- memory consolidation
- sync and durability work
- periodic verification or evaluation tasks

So heartbeat is part of the substrate, not a fixed behavior policy.

## Verification and Evolution

Simulation, judging, and symbolic verification should not be documented as
mandatory built-in loop phases of the current core.

They fit better as optional module layers that can:

- inspect snapshots
- read context memory entries and emit new events
- gate or repair proposed actions
- retain successful patterns into durable memory
- feed verified examples into training and distillation workflows

That direction is compatible with a self-evolving neuro-symbolic stack:

- neural models propose plans, edits, and candidate structures
- symbolic or deterministic checks verify them
- retained evidence feeds future module and model improvement

## Current Architectural Position

The stable invariant is:

- minimal engine
- stable module contract
- explicit provenance (`trigger | request | emit`)
- ingress-only pumping (`trigger`, `emit`)
- behaviorally composed orchestration
- replaceable module bundle

That is the shape the surrounding docs and research lanes should now reflect.
