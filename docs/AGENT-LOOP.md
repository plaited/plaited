# The Agent Loop

> **Status: ACTIVE** — Architecture note for the minimal agent core and
> factory-composed orchestration model. Cross-references: `ARCHITECTURE.md`
> (top-level system shape), `INFRASTRUCTURE.md` (deployment/runtime
> boundaries), `dev-research/default-factories/program.md` (active default
> factory bundle direction), `skills/constitution/` (governance patterns).

## Overview

Plaited treats the agent loop as a minimal core plus an installed factory
bundle.

The current architecture splits the system into:

1. a **minimal core** in `src/agent/create-agent.ts`
2. a set of **installed factories** that add planning, memory, skills, MCP,
   A2A, verification, and other orchestration layers

That means the active question is not "what does the built-in loop do?" It is
"which factory bundle is installed, and what orchestration does that bundle
compose on top of the core?"

## Minimal Core

`createAgent()` owns only a small execution substrate:

- `behavioral()` engine setup
- restricted trigger boundary
- signal and computed-signal installation
- heartbeat pulse
- built-in file, grep, bash, and inference handlers
- dynamic factory installation
- snapshot access through `useSnapshot`

The core is intentionally narrow. It does not define a canonical planning,
memory, simulation, judge, or context-assembly policy.

## Core Surface

The built-in core event surface is:

- `request_inference_primary`
- `request_inference_vision`
- `request_inference_tts`
- `read_file`
- `write_file`
- `delete_file`
- `glob_files`
- `grep`
- `bash`
- `heartbeat`
- `update_factories`
- `set_signal`
- `signal_schema_violation`
- `agent_disconnect`

These are engine-level primitives. They are not the full user-facing loop.

## Factory-Composed Orchestration

Factories receive:

- `trigger`
- `useSnapshot`
- `signals`
- `computed`

From those seams they can install:

- `bThreads`
- feedback handlers
- derived signals
- runtime policy

This is where higher-level loop behavior should now live.

Examples:

- a `memory-factory` can assemble retained context from snapshots and durable
  memory
- a `plan-factory` can own plan generation, current-plan signals, and
  re-planning rules
- a `skills-factory` can expose a searchable catalog of skills and inject a
  selected skill body into model context
- an `mcp-factory` can expose a searchable remote capability inventory without
  stuffing full tool schemas into the prompt
- an `a2a-factory` can project remote agent capabilities and routing policy
- a `verification-factory` can run symbolic or neural checks before allowing
  side effects
- an `edit-factory` can orchestrate `read_file` -> `models.primary` ->
  `write_file` as a higher-level editing primitive

## Context Assembly

Context assembly should be treated as a composed factory responsibility, not a
core invariant.

Likely contributors include:

- recent task or conversation state
- retained working and episodic memory
- current plan state
- selected skill metadata or body
- searchable MCP capability results
- prior verification failures or repair hints
- governance and constitution constraints

Different factory bundles may assemble context differently while still using
the same minimal engine underneath.

## Tools

The core currently provides low-level execution primitives, not a final
end-user tool UX.

### Built-In Primitives

| Primitive | Purpose |
|---|---|
| `read_file` | Read a workspace file |
| `write_file` | Write or create a workspace file |
| `delete_file` | Delete a workspace file |
| `glob_files` | Enumerate files by glob |
| `grep` | Search file content |
| `bash` | Execute a workspace-local Bun worker |
| `request_inference_primary` | Call the primary model |
| `request_inference_vision` | Call the vision model |
| `request_inference_tts` | Call the speech output model |

### Higher-Level Tools

Higher-level tools should usually be factory-owned compositions.

Examples:

- `edit_file` should be a small orchestration layer rather than a core
  primitive
- planning tools should come from a `plan-factory`
- skill selection and activation should come from `skills-factory`
- MCP discovery and tool routing should come from `mcp-factory`

## Heartbeat

The heartbeat is a core capability, but its meaning is factory-defined.

The core emits `heartbeat` on an interval. Factories can use that signal for:

- proactive sensing
- background maintenance
- memory consolidation
- sync and durability work
- periodic verification or evaluation tasks

So heartbeat is part of the substrate, not a fixed behavior policy.

## Verification and Evolution

Simulation, judging, and symbolic verification should not be documented as
mandatory built-in loop phases of the current core.

They fit better as optional factory layers that can:

- inspect snapshots
- read and write signals
- gate or repair proposed actions
- retain successful patterns into durable memory
- feed verified examples into training and distillation workflows

That direction is compatible with a self-evolving neuro-symbolic stack:

- neural models propose plans, edits, and candidate structures
- symbolic or deterministic checks verify them
- retained evidence feeds future factory and model improvement

## Current Architectural Position

The stable invariant is:

- minimal engine
- stable factory contract
- behaviorally composed orchestration
- replaceable factory bundle

That is the shape the surrounding docs and research lanes should now reflect.
