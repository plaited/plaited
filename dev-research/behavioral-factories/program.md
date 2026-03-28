# Behavioral Factories Program

## Purpose

Build deterministic behavioral factories that consume the default hypergraph and
compile it into runtime policy for the agent.

These factories are the symbolic execution layer for:

- tool selection
- search / retrieval triggers
- uncertainty handling
- decomposition and fanout
- stopping and escalation
- safety and boundary enforcement

## Why This Exists

The agent should not rely on the model alone to decide when to:

- search the web
- retrieve graph context
- ask the human
- stop and request evidence
- fan out multiple attempts
- reject unsupported output

These behaviors should be expressible as deterministic behavioral factories
driven by symbolic state and graph queries.

## Deterministic Boundary

This program is also deterministic at the core.

Deterministic responsibilities:

- map graph concepts to behavioral factories
- compile query results into BP rules or runtime policy objects
- validate factory integrity
- validate expected runtime decisions under tests

Generative responsibilities belong outside this core:

- propose alternative factory sets
- propose new thresholds or policies
- propose new graph-to-factory mappings

Those proposals may be optimized by autoresearch and fanout, but the runtime
baseline should be deterministic and testable.

## Core Artifacts

The main research artifacts for this program are:

- `dev-research/behavioral-factories/program.md`
- `skills/behavioral-core/SKILL.md`
- `skills/hypergraph-memory/SKILL.md`
- `skills/mss/SKILL.md`
- `src/tools/hypergraph.ts`

Stable validator/support surfaces:

- `scripts/behavioral-factories.ts`

Program-owned writable artifacts should live under
`dev-research/behavioral-factories/`. Do not rewrite the stable root
runner/validator script during fanout attempts.

Expected future artifacts:

- `dev-research/behavioral-factories/factories/`
- `dev-research/behavioral-factories/tests/`
- `dev-research/behavioral-factories/scripts/`

## Factory Targets

Initial behavioral factories should cover:

### Search / Retrieval

- when local symbolic context is sufficient
- when recall over the hypergraph is required
- when web search is required
- when evidence quality is too low to answer directly

### Decomposition

- when to stay single-threaded
- when to fan out multiple attempts
- when to merge candidate outputs
- when to stop expanding and return to the human

### Safety / Boundaries

- when tool execution should be blocked
- when confidence is too low to act
- when data boundaries imply ask / stop / deny

### MSS-Aware Composition

- treat `boundary` and `scale` as the strongest invariants
- treat `contentType`, `structure`, and `mechanics` as alignment-driven inputs
- prefer negotiation, translation, or generated realization over assuming global fixed equality
- treat grouping, promotion, and inheritance patterns as heuristics unless the graph marks them as hard constraints

### Human Escalation

- when to ask the operator for clarification
- when to request review instead of continuing
- when to surface uncertainty instead of guessing

## Runtime Contract

Behavioral factories should be derivable from:

- graph query results
- current task state
- current tool and sensor state
- explicit operator constraints

Factory outputs may be:

- behavioral-program threads
- deterministic policy objects
- runtime guard sets
- trigger rules

The important property is not the exact representation.
The important property is that the result is deterministic and testable.

## Evaluation

The main evaluation surface is deterministic:

- correct factory generation from known graph conditions
- correct blocking / allowing behavior
- correct search / retrieval invocation decisions
- correct escalation and stop decisions
- stable outputs from identical symbolic inputs

Later outer-loop metrics may include:

- fewer hallucinations
- better tool use
- better retrieval timing
- better search invocation precision
- lower wasted fanout

## Execution Contract

When this program is executed through autoresearch or fanout:

- use worktree-backed isolated attempts
- each attempt must write durable artifacts while running
- each attempt must run deterministic validation before completion
- selection should prefer deterministic validation and changed-artifact quality
  over freeform model preference

The concrete runner decides which agent harness, skills, and search providers
are available during a run. This program should specify when search, retrieval,
or escalation behavior is needed, not which operational tool surface provides it.

Lane-local helper scripts may be authored under
`dev-research/behavioral-factories/scripts/` to augment the stable validator
surface. They should not replace or override the root runner/validator entrypoint.

## Relationship To Default Hypergraph

This program consumes the graph defined by
`dev-research/default-hypergraph/program.md`.

The contract is:

- default hypergraph defines symbolic knowledge
- behavioral factories turn that knowledge into runtime behavior

More specifically:

- default-hypergraph owns the symbolic distinction between hard constraints and soft heuristics
- behavioral-factories must consume that distinction correctly
- factories should not hardcode older pre-agent assumptions about fixed structure registries, automatic contentType grouping, or universal scale promotion

## Long-Horizon Role

Autoresearch, fanout, and evolutionary search should optimize around these
factories, but the baseline set should remain deterministic so that harness
quality can be improved by measurable tests rather than subjective drift.
