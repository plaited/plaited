# Behavioral Factories Program

## Purpose

Compile seed and corpus graph artifacts into deterministic behavioral-factory
surfaces that can guide agent execution without relying on raw `SKILL.md`
material at runtime.

This lane exists downstream of:

1. `mss-seed`
2. `mss-corpus`

The intended order is:

1. `mss-seed` derives compact seed anchors.
2. `mss-corpus` encodes source material against those anchors.
3. `behavioral-factories` compiles runtime-usable policy/factory surfaces from
   the seed plus corpus.

## Inputs

Primary lane inputs:

- `dev-research/behavioral-factories/program.md`
- `dev-research/mss-seed/program.md`
- `dev-research/mss-corpus/program.md`
- `skills/behavioral-core/SKILL.md`
- `skills/hypergraph-memory/SKILL.md`
- `skills/mss/SKILL.md`
- `skills/modnet-node/SKILL.md`
- `skills/modnet-modules/SKILL.md`
- `src/agent/factories.ts`
- `src/tools/hypergraph.ts`

The lane should treat `mss-seed` and `mss-corpus` as upstream contracts.
It should not recreate those lanes’ responsibilities.

## External Retrieval

Primary evidence should come from the listed inputs and lane-provisioned
skills. If those are insufficient, external retrieval may use targeted web
search via the provisioned You.com skill.

Use external retrieval only to:

- confirm missing compilation semantics
- verify terminology or runtime patterns that are not present locally
- find bounded references that materially improve the factory contract

Do not treat web search as the primary source of truth for this lane.
If external retrieval materially changes the result, record that in the run
summary.

## Goal

Produce deterministic, reviewable behavioral-factory outputs such as:

- policy guards
- rule assertions
- fanout / merge selectors
- escalation / stop triggers
- safety / boundary guards

These outputs should be derived from graph-facing inputs, not from ad hoc
prompt-only behavior.

## Writable Surface

Only write within:

- `dev-research/behavioral-factories`

Expected lane-local outputs may include:

- `dev-research/behavioral-factories/factories/`
- `dev-research/behavioral-factories/artifacts/`
- `dev-research/behavioral-factories/tests/`

Do not write directly into:

- `dev-research/mss-seed`
- `dev-research/mss-corpus`
- `src/`
- `skills/`

unless a separate reviewed promotion step explicitly chooses to do so.

## What This Lane Enables

This lane should make it possible to:

- determine when local symbolic context is sufficient
- determine when retrieval or search is required
- determine when fanout is justified
- determine when safety or boundary guards should block execution
- determine when the agent should stop or escalate to the operator

## Deterministic Contract

The runtime-facing result should be deterministic for the same seed/corpus
inputs.

Deterministic responsibilities:

- map seed/corpus concepts into factory surfaces
- preserve hard invariants such as boundary and scale semantics
- emit stable factory outputs from the same graph-facing inputs
- validate factory structure and references

Probabilistic or autoresearch responsibilities:

- propose alternative compilation layouts
- compare factory sets
- suggest narrower or broader policy decompositions
- judge promotion candidates across attempts

## Validation

Deterministic validation should be preferred for promotion decisions.

Expected checks include:

- `bun scripts/behavioral-factories.ts validate`
- `bun --bun tsc --noEmit` when TypeScript changes
- targeted tests for this lane’s script/test surface

The lane should fail validation when:

- the program is missing or empty
- required upstream programs are missing
- required skills or runtime surfaces are missing
- changed files leave the lane writable surface

## Execution Contract

When run through autoresearch:

- use worktree-backed isolated attempts
- keep the main repo untouched during attempts
- write durable run artifacts while executing
- run deterministic validation before attempt completion
- prefer reviewable, lane-bounded outputs over broad speculative rewrites

`autoresearch-runner` owns:

- worktree creation
- attempt budgets
- parallel lane instances
- judging and promotion selection

This lane script owns:

- lane contract
- lane-local validation
- lane-local generation helpers

## Success Criteria

An attempt is stronger when it:

- preserves the seed/corpus dependency order
- keeps compilation logic lane-local and reviewable
- produces factory-oriented artifacts instead of raw ontology sprawl
- improves traceability between graph inputs and factory outputs
- does not drift into unrelated runtime/framework changes

## Promotion

Promotion is separate from generation.

Validated attempts may be judged and selected, but the main repo should only
change through explicit promotion of an accepted attempt.
