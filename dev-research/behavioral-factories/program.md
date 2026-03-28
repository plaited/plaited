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

Expected future artifacts:

- `dev-research/behavioral-factories/factories/`
- `dev-research/behavioral-factories/tests/`
- `scripts/behavioral-factories.ts`

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

- use one `git worktree` per attempt
- each attempt must write durable artifacts while running
- each attempt must run deterministic validation before completion
- selection should prefer deterministic validation and changed-artifact quality
  over freeform model preference

Minimum per-attempt artifacts:

- `status.json`
- `result.json`
- `stdout.log`
- `stderr.log`
- validation stdout / stderr logs
- diff summary

The runner may use Pi as the agent harness, but it should:

- disable automatic skill discovery
- pass only an explicit skill whitelist
- run in the attempt worktree as `cwd`
- preserve the worktree for inspection after the attempt finishes

## Relationship To Default Hypergraph

This program consumes the graph defined by
`dev-research/default-hypergraph/program.md`.

The contract is:

- default hypergraph defines symbolic knowledge
- behavioral factories turn that knowledge into runtime behavior

## Long-Horizon Role

Autoresearch, fanout, and evolutionary search should optimize around these
factories, but the baseline set should remain deterministic so that harness
quality can be improved by measurable tests rather than subjective drift.
