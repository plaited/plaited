# Project Isolation

## Goal

Explore and refine the multi-repo orchestration model for Plaited agents without
prematurely hard-coding unsettled routing and isolation policy into
`skills/project-isolation`.

This lane exists to evaluate what should become stable architecture versus what
should remain a research concern in project routing, subprocess isolation, and
cross-project coordination.

## Scope

This program is about:

- project-key routing and spawn policy
- process boundaries and constitution loading
- tool-layer assembly per project context
- multi-repo memory separation
- safe cross-project summarization, escalation, and promotion

This program is not primarily about:

- replacing the stable process-boundary doctrine already documented in the skill
- collapsing project isolation into one monolithic runtime path
- removing hard boundaries between repositories

## Inputs

- `skills/project-isolation/SKILL.md`
- `skills/constitution/SKILL.md`
- `skills/agent-loop/SKILL.md`
- `skills/hypergraph-memory/SKILL.md`
- `docs/PROJECT-ISOLATION.md`
- `docs/AGENT-LOOP.md`
- `docs/HYPERGRAPH-MEMORY.md`
- `src/agent/`
- `src/behavioral/`
- `scripts/autoresearch-runner.ts`

## Input Priority

Use these inputs with clear precedence:

1. stable runtime code and existing subprocess boundaries define the current floor
2. `skills/project-isolation` defines the present implementation guidance
3. docs and research infrastructure help identify what is still unresolved
4. new policy should be proposed explicitly rather than treated as already accepted architecture

## External Retrieval

This lane already receives explicit local inputs and lane-provisioned skills.
Treat those as the primary source surface.

External retrieval is allowed only when:

- local routing/isolation surfaces are insufficient for a bounded design decision
- multiple local sources conflict and external verification would clarify the tradeoff
- a missing reference pattern must be checked before it is proposed

External retrieval should remain supporting evidence, not the default authoring
surface.

## Expected Outputs

This lane should produce reviewable, lane-local artifacts such as:

- routing-policy proposals
- subprocess and spawn-lifecycle notes
- tool-assembly and permission-model proposals
- cross-project transfer and escalation guidelines
- evaluation criteria for safe multi-repo autonomy

Those outputs should stay under:

- `dev-research/project-isolation/`

## What You Can Edit

- `dev-research/project-isolation/program.md`
- lane-local artifacts created under `dev-research/project-isolation/`

## What You Cannot Edit

- `src/tools/`
- stable shared runtime surfaces unless a separate reviewed promotion step explicitly broadens scope

## Research Questions

This lane should help answer questions such as:

- what routing and reuse policies should be stable versus configurable
- where project subprocesses end and sub-agent policy begins
- how project-local constitutions and tool layers should be assembled and enforced
- what information may safely cross project boundaries, if any
- what evaluation criteria should gate greater multi-repo autonomy

## Run Loop

1. Confirm that the relevant project-isolation, constitution, memory, and agent-loop inputs exist.
2. Distinguish stable architecture rules from unresolved orchestration policy.
3. Produce or revise lane-local research artifacts under `dev-research/project-isolation/`.
4. Keep outputs bounded, reviewable, and explicit about tradeoffs and blast radius.
5. Promote only accepted conclusions into skills, runtime surfaces, or future lane scripts as a separate step.

## Success Criteria

- the lane produces reviewable multi-repo orchestration artifacts
- stable architecture and experimental policy are clearly separated
- outputs improve confidence about what should become durable project-isolation behavior
- proposed autonomy increases stay bounded by constitution and process-isolation concerns

## Validation

Deterministic checks should verify:

- the program exists and is non-empty
- required local inputs exist
- lane-local outputs stay within `dev-research/project-isolation/`

This lane is exploratory by design. It exists to refine the project-isolation
architecture and promotion criteria, not to pretend every routing and spawn
policy is already finalized.
