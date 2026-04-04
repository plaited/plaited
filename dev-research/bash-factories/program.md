# Bash Factories

## Goal

Research the smallest effective factory architecture around the minimal
`AGENT_EVENTS.bash` primitive so the default Plaited agent can use local
execution well without widening the core agent engine.

This lane should not try to recreate a giant shell tool inside `src/agent`.
The point is to hill-climb toward the right default factory bundle around a
thin execution primitive.

## Why This Lane Exists

`src/agent/create-agent.ts` currently treats `bash` as a minimal capability:

- validate that the requested worker path stays inside the workspace
- spawn `bun <worker> ...args`
- return `{ input, output }` through a signal-backed result envelope

That simplicity is intentional and should be preserved.

What remains unknown is which behaviors should become default factories around
that primitive so the shipped agent can:

- choose the right worker shape
- validate worker intent before execution
- normalize worker results into usable runtime state
- observe long-running execution cleanly
- recover when generated workers are under-specified or malformed

This is research work, not a reason to widen `create-agent.ts`.

## Dependency Order

1. `src/agent/create-agent.ts` defines the current architectural direction:
   behavior belongs in factories, not in the core agent engine.
2. `dev-research/default-factories/program.md` defines the umbrella question:
   which factory bundle should become the shipped default agent composition?
3. `skills/behavioral-core/SKILL.md` defines the BP coordination substrate.
4. `skills/code-patterns/SKILL.md` and related execution-oriented skills may
   provide reusable worker and validation patterns.
5. This lane hill-climbs the local-execution subproblem and feeds its winning
   candidates back into the umbrella default-factories lane.

## Core Hypothesis

The current `bash` primitive is probably close to the right core shape.

The missing work is not a larger core shell subsystem. The missing work is a
set of composable factories that make that primitive reliable enough for the
default agent.

In other words:

- core should stay small
- factories should absorb policy, routing, validation, normalization, and
  observability
- the default shipped agent should emerge from judged factory compositions
  rather than from one speculative up-front design

## Negative Goal

This lane should not:

- port another repo's shell tool wholesale into `src/agent`
- turn `AGENT_EVENTS.bash` into a generic string-shell surface
- hardcode broad execution policy into the core
- assume the first reasonable factory split is the final default

External shell-tool implementations may be used as pattern libraries and
comparison points, but this lane should extract transferable ideas rather than
copying architecture optimized for a different runtime.

## Research Questions

The main questions are:

- what is the smallest factory stack that makes `bash`-style execution usable
  for the default agent?
- which concerns belong in separate factories versus one bundled execution
  factory?
- when should the agent use purpose-built workers instead of generated workers?
- what worker contract is sufficient for generated workers to be safe,
  observable, and reviewable?
- what result shape is sufficient for other factories to build on?
- what observability is required before long-running execution is acceptable as
  a default behavior?

## Candidate Factory Hypotheses

This lane should explore at least these candidate patterns:

### 1. Worker Registry First

A factory bundle where execution stays simple because workers must be declared
in a registry with:

- path or id
- arg schema
- risk tags
- expected output schema
- execution profile

Hypothesis:

- most default-agent needs can be handled by a small set of typed workers
- generated workers become a narrower fallback surface

### 2. Preflight Manifest First

A factory bundle where each worker run must declare intended effects before the
actual run.

Potential declared surfaces:

- reads
- writes
- deletes
- env keys
- network use
- expected artifacts

Hypothesis:

- effect declaration plus BP gating yields enough safety and reviewability
  without expanding core

### 3. Result Normalization First

A factory bundle where raw worker output is treated as too weak for a useful
default agent, so factories normalize results into typed runtime signals.

Potential normalized states:

- completed
- completed_empty
- no_match
- partial
- timed_out
- malformed_output
- needs_followup

Hypothesis:

- the fastest gain comes from making execution results legible to later
  factories rather than from adding more validation first

### 4. Artifact Observability First

A factory bundle where the main missing piece is durable observability around
worker runs.

Potential patterns:

- JSONL progress stream
- rolling summary sidecar
- explicit artifact directory per run
- signal updates from artifact tails

Hypothesis:

- long-running execution only becomes viable as a default when it is observable
  and resumable through artifacts rather than opaque stdout

### 5. Execution Profiles First

A factory bundle where the critical distinction is not specific workers but
execution classes such as:

- read-only
- workspace-write
- destructive
- networked
- background

Hypothesis:

- a small set of execution profiles plus BP gating covers more real cases than
  a large worker registry alone

## Evaluation Targets

This lane should evaluate candidate factory bundles against tasks such as:

- run an existing typed worker correctly
- generate a new worker for a bounded task
- recover from malformed worker output
- refuse or escalate under-specified worker intent
- observe a long-running worker through artifacts
- keep the mental model simple enough for the default agent

Success should not be measured only by task completion.

The lane should also score:

- architectural clarity
- amount of policy added to core versus factories
- observability quality
- retry and recovery behavior
- how often the model can use the pattern correctly without handholding

## Desired Outputs

This lane should produce:

- one or more candidate factory bundles around the minimal `bash` primitive
- eval tasks and rubrics for comparing those bundles
- retained examples of successful worker contracts
- retained examples of failed or ambiguous worker contracts
- a recommendation for which factory bundle should become the default shipped
  behavior
- explicit notes on what must remain in core versus what should stay factory-owned

## Promotion Criteria

A candidate should be promotable only if it:

- keeps `src/agent/create-agent.ts` minimal
- composes cleanly through the existing factory contract
- improves default-agent execution quality on judged tasks
- produces durable and reviewable observability for long-running runs
- gives the model a simpler, not more confusing, operator surface

If a candidate improves one metric by introducing a large opaque policy blob,
it should not be treated as a successful default direction.

## Relation To Other Factory Lanes

This lane is a focused subprogram under the broader default-factory research
structure.

The split should be read as:

- `default-factories` is the umbrella lane that decides what concrete bundle
  should ship by default
- `bash-factories` researches the bounded local-execution part of that default
  bundle

This lane should therefore optimize for two things at once:

- strong local performance on execution-related tasks
- compatibility with broader default-factory integration

Its results should feed into the umbrella default-factories lane rather than
be treated as a complete standalone doctrine for the whole agent.
