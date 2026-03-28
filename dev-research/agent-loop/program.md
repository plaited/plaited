# Agent Loop

## Goal

Explore and refine the parts of the agent loop architecture that are still
evolving, without overloading `skills/agent-loop` with unsettled policy.

This lane exists to separate stable loop contracts from research around
proactive behavior, sub-agent orchestration, autonomy policy, and loop-level
evaluation strategy.

## Scope

This program is about:

- proactive extensions to the loop
- sub-agent and judge orchestration policy
- loop-level autonomy and escalation strategy
- context-assembly and evaluation tradeoffs
- what parts of loop behavior should become durable memory or training surfaces

This program is not primarily about:

- replacing the stable 6-step loop contract
- rewriting the core event vocabulary without cause
- treating experimental policy as if it were already runtime doctrine

## Inputs

- `skills/agent-loop/SKILL.md`
- `skills/behavioral-core/SKILL.md`
- `skills/constitution/SKILL.md`
- `skills/hypergraph-memory/SKILL.md`
- `skills/proactive-node/SKILL.md`
- `docs/AGENT-LOOP.md`
- `docs/HYPERGRAPH-MEMORY.md`
- `docs/SAFETY.md`
- `src/agent/`
- `src/behavioral/`

## Input Priority

Use these inputs with clear precedence:

1. stable runtime code and existing loop seams define the current floor
2. `skills/agent-loop` defines the present loop contract
3. related skills and docs help identify unresolved policy and integration questions
4. exploratory loop policy should be proposed explicitly rather than treated as already accepted architecture

## External Retrieval

This lane already receives explicit local inputs and lane-provisioned skills.
Treat those as the primary source surface.

External retrieval is allowed only when:

- local loop and memory surfaces are insufficient for a bounded design decision
- multiple local sources conflict and external verification would clarify the tradeoff
- a missing pattern or precedent must be checked before it is proposed

External retrieval should remain supporting evidence, not the default authoring
surface.

## Expected Outputs

This lane should produce reviewable, lane-local artifacts such as:

- loop-policy notes
- proactive and sub-agent orchestration proposals
- evaluation and escalation criteria
- context-assembly tradeoff notes
- promotion criteria for future loop/runtime changes

Those outputs should stay under:

- `dev-research/agent-loop/`

## What You Can Edit

- `dev-research/agent-loop/program.md`
- lane-local artifacts created under `dev-research/agent-loop/`

## What You Cannot Edit

- `src/tools/`
- stable runtime loop code unless a separate reviewed promotion step explicitly broadens scope

## Research Questions

This lane should help answer questions such as:

- what proactive behavior belongs in the stable loop versus separate lane policy
- how sub-agents and judges should interact with the loop without overcomplicating the core runtime
- what loop-level evaluation and promotion signals should guide training and improvement
- what autonomy and escalation policy belongs in the loop versus higher-level orchestration
- what loop behavior should become durable semantic memory rather than remain prose

## Run Loop

1. Confirm that the relevant loop, behavioral, memory, and safety inputs exist.
2. Distinguish stable loop contracts from unresolved autonomy and orchestration policy.
3. Produce or revise lane-local research artifacts under `dev-research/agent-loop/`.
4. Keep outputs bounded, reviewable, and explicit about what is stable versus proposed.
5. Promote only accepted conclusions into skills, runtime surfaces, or future lane scripts as a separate step.

## Success Criteria

- the lane produces reviewable loop-architecture artifacts
- stable loop contracts are separated from still-experimental policy
- outputs improve confidence about future loop/autonomy changes
- future runtime changes have clearer promotion criteria

## Validation

Deterministic checks should verify:

- the program exists and is non-empty
- required local inputs exist
- lane-local outputs stay within `dev-research/agent-loop/`

This lane is exploratory by design. It exists so loop policy can mature through
explicit research and promotion rather than quietly accreting inside the skill.
