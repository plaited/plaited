# Slice 18

## Target

Calibrate the raw-card inclusion judge and meta-verifier instructions on a
bounded disagreement and edge-case set before rerunning the full HyperCard
raw-card inclusion lane.

## Scope

- `scripts/modnet-raw-card-inclusion-judge.ts`
- `scripts/modnet-raw-card-inclusion-meta-verifier.ts`
- `scripts/modnet-judge-ablation.ts`
- `scripts/modnet-build-judge-ablation-heldout.ts`
- `scripts/modnet-build-judge-ablation-pass2.ts`
- `dev-research/modnet/catalog/`
- `dev-research/modnet/`

## Required

- treat this as prompt calibration, not another model-selection slice
- use the current production-shaped target stack:
  - primary judge: `glm-5`
  - meta-verifier: `minimax-m2.5`
- keep the reference control stack fixed as:
  - `sonnet -> minimax-m2.7`
- use fixed calibration inputs drawn from:
  - `dev-research/modnet/catalog/modnet-judge-ablation-heldout.raw-card-inclusion.jsonl`
  - `dev-research/modnet/catalog/modnet-judge-ablation-heldout.raw-card-inclusion.pass2.jsonl`
  - disagreement rows extracted from the per-run `/tmp/modnet-judge-ablation.*.jsonl` artifacts
  - disagreement rows from the held-out ablation runs
  - obsolete-medium but durable-job rows
  - thin implementation demos
  - one-off migration shims
  - niche-but-real operator utilities
  - obvious content-only or nostalgia-only discards
- run an `8`-agent fanout dedicated to instruction improvement
- assign the `8` calibration agents to:
  - obsolete-medium rescue
  - thin-demo rejection
  - content-vs-workflow separation
  - migration-shim normalization
  - niche-operator preservation
  - analog-restraint auditing
  - pass/decision/score coherence
  - rerun gatekeeping
- improve both prompts so they explicitly:
  - recover durable workflows even when the original medium is obsolete
  - avoid rewarding generic abstraction jumps unsupported by the text
  - reject thin demos, syntax showcases, and trivia-only artifacts
  - keep `pass`, `inclusionDecision`, score, and reasoning coherent
- keep the candidate outputs fixed during this slice:
  - do not regenerate raw-card inclusion candidates
  - do not change the held-out row payloads
- validate the revised prompt pair on the bounded calibration set before any
  full-corpus rerun

## Preserve

- treat obsolete medium as a warning sign, not an auto-discard
- preserve niche physical or operator workflows when they still imply a bounded
  modern module or utility
- keep the calibration set and output artifacts deterministic enough to replay
  later

## Avoid

- reopening broad model shopping during this slice
- rerunning all raw cards before the prompt pair is recalibrated
- rewarding “clever” generic analogs that are not supported by the title and
  description
- collapsing every obsolete artifact into `discard` just because the original
  transport, storage, or packaging medium is dead

## Acceptance Criteria

- a revised raw-card judge prompt exists
- a revised raw-card meta-verifier prompt exists
- the revised prompts are validated on the bounded calibration set
- the validation rerun shows:
  - fewer obsolete-medium false discards
  - fewer thin-demo or content-only false keeps
  - fewer artifact-only disagreements caused by pass/score contract noise
  - stable or better spend/runtime for the chosen production-shaped stack
- the slice produces a clear rerun decision for the full raw-card inclusion
  lane

## Deliverable

A calibrated raw-card inclusion judge/meta prompt pair, plus a documented
calibration set and rerun checklist, ready to drive the next full HyperCard
raw-card inclusion pass.
