# Plaited Native Model: Revised Proof Plan

Quick validation of the native-model distillation path, updated to reflect what
the repo has actually proven.

## Core Question

Can Plaited's current validation, curation, training, and comparison workflow
produce a Falcon-family model that measurably improves on Plaited-native tasks
such as:
- MSS-grounded module generation
- controller-compatible UI generation
- BP / PM / provenance-aware runtime reasoning

## What We Have Already Proven

On this Mac, the local bootstrap loop now works end to end:
- curated eval outputs can be turned into an SFT boundary
- a Bun wrapper can launch the uv-managed MLX trainer
- Falcon can be served locally with or without a LoRA adapter
- untuned and tuned runs can be compared before promotion

The first successful local bootstrap run used:
- `mlx-community/Falcon-H1R-7B-4bit`
- `--max-seq-length 384`
- `--num-layers 2`
- `--iters 20`

That proved infrastructure, not quality.

## What We Learned

The local Mac path is valid as a bootstrap/control-plane workflow, but not as a
serious Falcon training box.

Observed result from the first tuned-vs-untuned comparison:
- untuned local Falcon pass rate: `0.250`
- tuned local Falcon pass rate: `0.250`
- untuned local Falcon avg score: `0.792`
- tuned local Falcon avg score: `0.776`
- net result: no improvement, slight regression

Meaning:
- the workflow is worth keeping
- the tuned adapter is not a promotion candidate
- real quality work should move to the MSI machine

## Revised Experiment

### Phase 0: Completed Local Bootstrap

Goal:
- prove train -> eval -> compare -> no-promotion gating works

Status:
- complete

Outcome:
- succeeded as infrastructure proof
- failed as model-quality proof

### Phase 1: First Serious MSI Run

Goal:
- repeat the same loop on the MSI box with more headroom
- reduce truncation
- run a real untuned-vs-tuned comparison before promotion

Execution:
- keep the same curated dataset boundary
  - `dev-research/native-model/evals/curated-good-outputs.jsonl`
- keep the same Bun operator surface
  - `bun run native-model:bootstrap-cycle`
  - `bun run native-model:compare`
- swap the trainer backend
  - MLX on Mac
  - CUDA / Unsloth-style training on MSI

Success criteria:
- tuned model beats untuned baseline on pass rate and/or score
- no obvious regression in the surviving prompt families
- promotion only if comparison shows a clear improvement

## Cost Model

The old H100 estimate is no longer the right planning frame.

### Frontier Generation Cost

Current reality:
- Codex generation is currently subscription-backed in our workflow
- marginal generation cost is therefore close to `$0` per run from the repo's
  perspective while we stay on the subscription path

Important caveat:
- this is not universally free
- if generation moves to API-based workers later, frontier API spend should be
  budgeted separately instead of assuming subscription economics

### Frontier Judge Cost

This remains the primary variable external cost.

Current planning baseline from the repo:
- Sonnet + Haiku judging: about `$140-160` per full judged run

That means:
- generation is currently cheap because of subscription economics
- judging is still real API spend
- native-model evaluation loops should be planned around judge cost first

### Wall-Clock Latency

The old 48-hour H100 framing also understated elapsed time.

Why it was off:
- it treated GPU access as the main bottleneck
- it did not properly account for frontier request latency during generation,
  judging, and meta-verification
- it assumed more parallelism than the current workflow can actually exploit

Current reality:
- generation and judging both incur network/API latency even when generation is
  subscription-backed rather than metered per token
- the harness still has sequential sections where one stage must finish before
  the next can be trusted
- some experiments can run in parallel, but not the whole loop

Examples of sequential dependency:
- collect outputs before deciding what is curation-worthy
- train before tuned evaluation
- run untuned and tuned comparisons before promotion
- in repo autoresearch, keep/revise decisions and validation stages remain
  ordered rather than massively parallel

So the real planning constraint is:
- frontier latency plus judge throughput plus training/eval turnaround

not just:
- raw GPU-hours

### Local Training Cost

On owned hardware:
- Mac bootstrap MLX runs: near-zero marginal compute cost, but low quality
- MSI training runs: near-zero marginal cloud cost, but real hardware cost and
  setup time

Hardware framing:
- the MSI box is a sunk or amortized capital expense
- once it is available, repeated training/eval cycles should be materially
  cheaper than renting H100 time for this stage

## Updated Estimate

### Proof-of-Loop

Already achieved on the Mac.

Cost:
- low incremental compute cost
- some Anthropic judge cost for validation/evaluation

### First Real Quality Attempt

Target:
- MSI box, same curated boundary, same comparison loop

Estimated marginal run cost:
- generation: `$0` marginal while Codex remains subscription-backed
- judging: roughly `$140-160` per judged run
- training compute: local hardware, so no cloud rental line item

The real near-term expense is therefore:
- frontier judge API spend
- engineering/setup time on the MSI box
- elapsed time lost to sequential frontier-model and evaluation stages

not:
- H100 rental

## Recommendation

Do not pitch this as a 48-hour H100 experiment anymore.

Pitch it as:
- a workflow that is already proven locally
- a model-quality question that now needs MSI hardware
- a staged proof path with modest marginal cash burn while Codex generation is
  subscription-backed
- a workflow whose wall-clock time is still constrained by frontier-model
  latency and sequential evaluation gates, not just by training hardware

Short version:
- Mac proved the loop
- Mac did not prove model improvement
- MSI is the next real test
- judge API spend is the main recurring external cost today
- wall-clock time is limited by frontier latency and sequential stages more than
  by cloud GPU availability
