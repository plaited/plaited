# Genome Architecture

> **Status: ACTIVE** — Extracted from SKILLS-RESTRUCTURING.md. Defines the seeds/tools/eval taxonomy for skills. Cross-references: `AGENT-LOOP.md` / `skills/agent-loop/` (agent-loop seed scope), `CONSTITUTION.md` (governance skills), `TRAINING.md` (eval category feeds training).

## Context

The server refactoring (completed) exposed a gap: `generative-ui` skill bundles transport + protocol + rendering into one monolith, and `agent-build` (427 lines) tries to cover the entire agent loop. When the server changed, there was no clear skill to update — it didn't fit cleanly into any existing skill's scope.

Meanwhile, two external references point toward a more powerful model:
- **AI Analyst Genome** — a single markdown document (~1400 lines) that bootstraps an entire AI Data Analyst product through a 3-layer inception model (meta-agents → builders → domain agents). Key innovations: CONTRACT blocks declaring inputs/outputs/dependencies, wave-based build tracking, quality gates between phases.
- **One-Person Unicorn / Revised Strategy** — genome-driven federated agent hosting where a single genome file generates complete platforms. Four products from one specification. The genome encodes decisions + constraints, not just patterns.

The current skills are **reference documentation** — they teach an AI how to USE existing code. The genome approach produces **generative seeds** — they encode enough design knowledge that an AI can REBUILD the system from first principles.

## The Problem with Current Skills

| Skill | Lines | Problem |
|-------|-------|---------|
| `agent-build` | 427 | Covers everything: loop, events, bThreads, waves, discoveries. Too broad to maintain or compose. |
| `generative-ui` | 351 | Bundles transport (WebSocket), protocol (render/attrs), rendering (SSR/styles), and custom elements. Server changes don't fit. |
| `behavioral-core` | 286 | Good scope, but documents API usage only — not the design decisions that make BP work. |
| `ui-testing` | 276 | Good scope, references fixtures as living examples. |

Framework knowledge and development tools are mixed: `behavioral-core` (framework) lives alongside `typescript-lsp` (tool) with no distinction.

## Recommendations

### 1. Decompose into Architectural Layer Seeds

Replace the current monoliths with focused seeds, one per architectural layer:

| Seed | Scope | Source |
|------|-------|--------|
| `behavioral-engine` | BP algorithm, bThread/bSync, event selection, snapshot observability | Deepens existing `behavioral-core` |
| `server-transport` | `createServer`, WebSocket lifecycle, pub/sub topics, trigger bridge, `SERVER_EVENTS` | **NEW** — extracted from `generative-ui` + new server code |
| `generative-ui-protocol` | Controller protocol (render/attrs/update_behavioral), swap modes, `p-trigger`/`p-target`, SSR pipeline, custom elements | Refined `generative-ui` — protocol + rendering only, no transport |
| `agent-loop` | 6-step loop, seams, gate/simulate/evaluate, constitution, memory, AgentNode | Extracted from `agent-build` |
| `modnet-node` | Module architecture, A2A bindings, access control, enterprise topology, workspace structure | **DONE** — extracted from `docs/MODNET-IMPLEMENTATION.md` |

Each seed is self-contained enough that an AI reading only that seed can rebuild its layer. The `agent-build` skill gets retired — its content distributes across `agent-loop` and `modnet-node`.

### 2. Add "Key Decisions" Sections — Encode WHY, Not Just WHAT

Current skills document patterns but not their alternatives or rationale. The genome approach succeeds because it captures the reasoning behind decisions. Each seed adds a **Key Decisions** section:

```markdown
## Key Decisions

### Pipeline pass-through over conditional bypass
- **Decision**: Events flow through the full simulate → evaluate → execute pipeline regardless of which seams are present
- **Alternative considered**: `if (!seam) shortCircuit()` — skip stages when seams are absent
- **Why this choice**: Eliminates conditional routing. Adding/removing seams is a handler-level concern, not a routing change. Single code path is easier to reason about.
- **Invariant**: Every `context_ready` event reaches `execute` or a rejection — no silent drops.
```

This is what makes a seed "generative" — an AI can make the RIGHT choices because it understands the constraints, not just the shapes. The existing "Key Discoveries" in `agent-build` already captures some of this; the restructuring formalizes it per-layer.

### 3. Introduce CONTRACT Frontmatter for Composition

Extend the existing YAML frontmatter with composition metadata, borrowed from the AI Analyst Genome's CONTRACT pattern:

```yaml
---
name: server-transport
description: Thin I/O bridge between browser WebSocket and agent BP engine
license: ISC
compatibility: Requires bun
# ── Genome composition fields ──
layer: transport
wave: 1
produces:
  - createServer factory
  - SERVER_EVENTS vocabulary
  - WebSocket lifecycle (connect/disconnect/error)
  - Pub/sub topic derivation
consumes:
  - Trigger type (from behavioral-engine)
  - ClientMessageSchema (from generative-ui-protocol)
depends-on:
  - behavioral-engine
---
```

This makes the skill DAG explicit. A composition tool (or a meta-seed) can read these to determine build order, validate dependencies, and detect gaps. The `wave` field enables incremental regeneration — rebuild only one layer.

**Note**: This extends the AgentSkills spec's optional `metadata` field rather than breaking spec compliance.

### 4. Create a `plaited-genome` Meta-Seed

A top-level orchestration document (in `skills/`) that knows how to compose the layer seeds into a complete Plaited node. Analogous to the AI Analyst Genome's main 1400-line specification:

```markdown
# Plaited Genome

## Wave Ordering
| Wave | Layer | Seed | Gate |
|------|-------|------|------|
| 0 | Foundation | behavioral-engine | BP algorithm tests pass |
| 1 | Transport | server-transport | WebSocket lifecycle tests pass |
| 2 | Protocol | generative-ui-protocol | Browser controller tests pass |
| 3 | Agent | agent-loop | Agent loop + seam tests pass |
| 4 | Node | modnet-node | Module sidecar + workspace structure validated |

## Composition Contract
- Wave N seeds may only `consume` from waves ≤ N
- Each wave has a quality gate (test suite + type check)
- Seeds in the same wave are independent (can be built in parallel)

## Node Structure
Declares the expected output: what a complete Plaited node looks like
when all seeds have been applied (directory structure, entry points,
configuration files).
```

This is the "genome" — the document that, given to Claude Code, can orchestrate building a complete node by activating seeds in wave order. It doesn't contain implementation details (those live in layer seeds); it contains composition logic.

### 5. Separate "Framework Seeds" from "Development Tools"

Current skills mix two fundamentally different concerns:

| Category | Skills | Role |
|----------|--------|------|
| **Framework seeds** | behavioral-engine, server-transport, generative-ui-protocol, agent-loop, modnet-node | Generative — encode HOW TO BUILD the system |
| **Development tools** | typescript-lsp, validate-skill, code-patterns, code-documentation, optimize-agents-md | Operational — encode HOW TO WORK in the system |
| **Evaluation** | trial-runner, trial-adapters, compare-trials, ui-testing | Verification — encode HOW TO TEST the system |

Framework seeds are the genome. Tool skills are the development environment. Evaluation skills are the quality gates. Making this distinction explicit (via a `category` frontmatter field or directory structure) lets the meta-seed know which skills to compose vs. which are ambient tooling.

**Directory structure option:**
```
skills/
  seeds/              # Framework genome seeds
    behavioral-engine/
    server-transport/
    generative-ui-protocol/
    agent-loop/
    modnet-node/
    plaited-genome/   # Meta-seed (composition orchestrator)
  tools/              # Development environment
    code-patterns/
    code-documentation/
  eval/               # Quality gate skills
    trial-runner/
    trial-adapters/
    compare-trials/
    ui-testing/
```

## Execution Plan

### Phase 1: Restructure directories + create `server-transport` seed
1. Create `skills/seeds/` and `skills/tools/` and `skills/eval/` subdirectories
2. Move existing skills into appropriate categories (trial-runner, trial-adapters, compare-trials → eval/; code-patterns, code-documentation → tools/)
3. Write `skills/seeds/server-transport/SKILL.md` — covers `createServer`, `SERVER_EVENTS`, `SERVER_ERRORS`, WebSocket upgrade, pub/sub, trigger bridge. Include "Key Decisions" section documenting the trigger-based architecture choice.
4. Add CONTRACT frontmatter to `server-transport`

### Phase 2: Refine `generative-ui` → `generative-ui-protocol`
1. Move to `skills/seeds/generative-ui-protocol/`
2. Remove transport content (now in `server-transport`)
3. Add "Key Decisions" section (setHTMLUnsafe choice, restrictedTrigger design, swap modes)
4. Add CONTRACT frontmatter with `depends-on: [behavioral-engine, server-transport]`
5. Update references/ to reflect protocol-only scope

### Phase 3: Deepen `behavioral-core` → `behavioral-engine`
1. Move to `skills/seeds/behavioral-engine/`
2. Add "Key Decisions" section (synchronous engine, `selectNextEvent` priority, predicate listeners, ephemeral vs persistent blocks)
3. Add CONTRACT frontmatter (wave: 0, produces: behavioral() + bThread + useFeedback + useSnapshot)
4. Existing reference files (algorithm-reference.md, behavioral-programs.md) already provide good depth

### Phase 4: Extract `agent-loop` from `agent-build`
1. Create `skills/seeds/agent-loop/SKILL.md` — the 6-step loop, event vocabulary, seam pattern, three-layer architecture, per-call dispatch, key discoveries
2. Add "Key Decisions" section (pipeline pass-through, per-call threads > persistent shared-state, interrupted thread timing, narrow world view)
3. Add CONTRACT frontmatter with `depends-on: [behavioral-engine]`
4. Retire the old `agent-build` seed location — content fully distributed

### Phase 5: Create `modnet-node` and `plaited-genome`
1. Write `skills/seeds/modnet-node/SKILL.md` — module architecture, MSS tags, sidecar, workspace structure, governance factories
2. Write `skills/seeds/plaited-genome/SKILL.md` — the meta-seed with wave ordering, composition contract, quality gates
3. Add CONTRACT frontmatter to both

### Phase 6: Update cross-references
1. Update "Related Skills" sections across all seeds
2. Run `bun plaited validate-skill skills/` to validate all

## NOT Changing
- `AGENTS.md` rules — independent of skill restructuring
- `src/` code — this plan restructures skills/documentation only, no code changes
- Test files — existing tests remain as-is

## Verification
```bash
# Validate all skills against AgentSkills spec
bun plaited validate-skill skills/seeds skills/tools skills/eval

# Verify no broken cross-references
grep -r "Related Skills" skills/ | grep -v node_modules
```
