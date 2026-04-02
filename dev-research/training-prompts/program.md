# Modnet Program

## Purpose

This file is the standing context root for the modnet prompt review workflow.

The workflow is human-in-the-loop:

- the human reviews prompts and decides what should happen next
- local tooling orchestrates fanout, judging, persistence, and resume
- generator attempts may vary by strategy note or decomposition approach
- `glm-5` generates candidate prompts
- `m2.5` judges those candidates with a fixed rubric

The goal is not another autonomous research lane. The goal is a durable,
reviewable operator workflow where:

- a human reviews prompts directly
- model-written alternatives are generated under bounded fanout
- a judge scores those alternatives against shared Modnet/MSS context
- the runtime persists every decision and attempt locally
- final exported artifacts stay minimal and training-oriented

## Inputs

The prompt source catalog is:

- `dev-research/training-prompts/catalog/prompts.jsonl`

Each row is minimal:

- `id`
- `prompt`

## Shared Context

The local tooling loads this file together with selected skills references and
passes that same shared context to:

- `glm-5` when it generates a candidate
- `m2.5` when it judges a candidate

The current shared context surface is:

- `dev-research/training-prompts/program.md`
- `skills/modnet-modules/SKILL.md`
- `skills/mss/SKILL.md`
- `skills/mss/references/modnet-standards-distilled.md`
- `skills/mss/references/structural-ia-distilled.md`
- `skills/mss/references/valid-combinations.md`

That shared context is the main source of modnet/MSS guidance.

## Roles

### Human

The human is the final verifier.

The human may:

- keep
- remove
- refine
- accept a winner
- reject a winner
- ask for another refinement round
- ask for lower-scale derivation after approval

### Local Tooling

The local tooling is the control plane.

It is responsible for:

- loading prompts from the catalog
- tracking queue state and decisions
- launching fanout rounds
- persisting attempt artifacts under `.prompts/`
- resuming interrupted work
- surfacing only the winning candidate back to the human

This runtime must not rely on Codex as a participant.

### Generator

`glm-5` is the generator.

It receives:

- the shared context
- the source prompt
- any human feedback
- any local strategy note for that attempt

It returns one candidate prompt plus MSS tags.

### Judge

`m2.5` is the judge.

It receives:

- the same shared context
- the same source prompt
- the same human feedback
- the generated candidate

It uses a fixed rubric to score:

- standalone training usefulness
- coherence with modnet/MSS context
- fit to the source prompt and human feedback
- clarity and boundedness of MSS tags

The human is the final verifier. There is no meta-verifier in this workflow.

## Runtime

Default fanout shape:

- `5` workers per round
- up to `15` attempts per worker

The human sees only the round winner, not every variant.

Each attempt may vary by strategy note, wording pressure, or decomposition
approach, but all attempts must share the same base prompt and human feedback
for that round.

## Runtime Artifacts

Local runtime artifacts live under:

- `.prompts/`

They may include:

- state files
- decisions
- attempt records
- worker winners
- round winners
- temporary exports

Each attempt must write durable artifacts while running:

- input payload
- result payload
- stdout log
- stderr log
- status file

## Final Artifact

The final training artifact is minimal:

- `id`
- `prompt`
- `mss`

No parent lineage, judge metadata, attempt history, or review notes belong in
the final exported corpus.
