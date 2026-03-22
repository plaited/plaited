# Native Model Proof Plan

This document explains what Plaited has already proven in the native-model
lane, what is still unproven, what the next experiment should be, and what the
real cost and timing constraints look like.

## Purpose

The point of this plan is not to sell a vague model-training story.

It is to answer a practical question:

Can Plaited's current validation, curation, training, and comparison workflow
produce a Falcon-family model that measurably improves on Plaited-native tasks?

Those tasks include:
- MSS-grounded module generation
- controller-compatible UI generation
- BP / PM / provenance-aware runtime reasoning

Later stages should push beyond symbolic correctness alone and increasingly ask:
- does the model help produce useful module outcomes?
- does the resulting browser or interaction behavior hold up under simulation?
- does the system improve outcomes for non-technical end-user experiences?

## What Is Already Proven

### The Workflow Works

On this Mac, the local bootstrap loop now works end to end:
- curated eval outputs can be turned into an SFT boundary
- a Bun wrapper can launch the uv-managed MLX trainer
- Falcon can be served locally with or without a LoRA adapter
- untuned and tuned runs can be compared before promotion

Why this matters:
- the infrastructure is no longer hypothetical
- the project already has a working train -> eval -> compare loop
- future work on the MSI box can reuse the same operator surface instead of
  starting from scratch

### The Mac Proved Infrastructure, Not Quality

The first successful local bootstrap run used:
- `mlx-community/Falcon-H1R-7B-4bit`
- `--max-seq-length 384`
- `--num-layers 2`
- `--iters 20`

Why this matters:
- it proves the local stack can produce a real adapter
- it does not prove the adapter is good
- the settings were small enough to fit memory, not large enough to support a
  serious quality claim

## What We Learned

### The Mac Is a Control-Plane Box

The local Mac path is valid as a bootstrap/control-plane workflow, but not as a
serious Falcon training box.

What it is good for:
- validation
- curation
- adapter smoke tests
- tiny quantized bootstrap runs
- train/eval/compare workflow development

What it is not good for:
- longer-context Falcon training
- less-truncated runs
- larger or repeated quality experiments
- drawing conclusions about the real training ceiling

Why this matters:
- it keeps the Mac useful
- it prevents overinterpreting a successful bootstrap run as proof that this is
  the right long-term training hardware

### The First Tuned Adapter Did Not Improve the Baseline

Observed result from the first tuned-vs-untuned comparison:
- untuned local Falcon pass rate: `0.250`
- tuned local Falcon pass rate: `0.250`
- untuned local Falcon avg score: `0.792`
- tuned local Falcon avg score: `0.776`
- net result: no improvement, slight regression

Why this matters:
- the loop is worth keeping
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

Why this phase still matters:
- it removed major uncertainty about environment setup, auth, training launch,
  serving, validation, and promotion logic
- it gives the MSI phase a working baseline workflow

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

Why this is the right next step:
- it preserves the workflow that is already working
- it changes the actual limiting factor: hardware headroom

### Phase 2: Tool-Aware Module Tasks

Goal:
- move beyond prompt/output-only distillation
- capture inspect/edit/validate/revise behavior on realistic module tasks
- evaluate those behaviors against browser and module outcomes where relevant

This phase should not be framed as generic coding-agent improvement.
It should be framed as improving the model's ability to operate toward
Plaited-native module and UX goals.

### Phase 3: Autonomous Improvement On Real Tasks

Goal:
- teach breadth/depth coordination and safe promotion behavior
- optimize against realistic module and modnet-adjacent tasks
- use multiple attempts, simulation, and evaluation to improve outcome quality

Important boundary:
- this does not require collapsing the `modnet` lane into
  `runtime-taxonomy` or `native-model`
- it does require the native-model lane to aim at realistic module/modnet
  outcomes rather than staying trapped in framework-only exercises

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

Why this matters:
- the current workflow should not be priced as if every Codex generation step
  were an API bill
- subscription economics change the cost shape, even though they do not remove
  latency

### Frontier Judge Cost

This remains the primary variable external cost.

Current planning baseline from the repo:
- Sonnet + Haiku judging: about `$140-160` per full judged run

That means:
- generation is currently cheap because of subscription economics
- judging is still real API spend
- native-model evaluation loops should be planned around judge cost first

Why this matters:
- the external cash burn is now more about grading than generation
- any plan that ignores judge spend is understating the real loop cost

### Local Helper Models

MSI does not only matter for Falcon training. It also creates an option to run
local helper models next to Falcon in order to reduce frontier dependence and
improve iteration speed.

Possible role split:
- Falcon = student model being trained and evaluated
- local helper model = draft generation, repair, retrieval assistance, or
  judge-lite filtering
- frontier judge = final external grading until local judging is trustworthy

Practical implication:
- Codex does not necessarily have to disappear
- Codex can remain the operator workflow while some runs are redirected to local
  OpenAI-compatible servers via profiles
- Qwen-family models served through vLLM are a plausible first local-helper path
- Kimi-family models may also work through vLLM, but they are a riskier and
  heavier operational choice

Why this matters:
- it can reduce marginal frontier-model spend
- it can reduce waiting on frontier request latency for some stages
- it can keep more of the loop local once the MSI box is ready

Important limit:
- this does not eliminate the need for strong final judging yet
- local helper outputs should still go through the same curation and promotion
  rules before becoming distillation data

### Local Training Cost

On owned hardware:
- Mac bootstrap MLX runs: near-zero marginal compute cost, but low quality
- MSI training runs: near-zero marginal cloud cost, but real hardware cost and
  setup time

Hardware framing:
- the MSI box is a sunk or amortized capital expense
- once it is available, repeated training/eval cycles should be materially
  cheaper than renting H100 time for this stage

Why this matters:
- the relevant planning question is whether the MSI box is worth keeping
- it is not whether every run should be priced like rented cloud GPU time

## Time Model

### The Old 48-Hour Estimate Was Too Optimistic

The old H100 framing also understated elapsed time.

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

Why this matters:
- wall-clock time is constrained by frontier latency and evaluation ordering,
  not only by training hardware
- accurate timing will not be known until the MSI loop is actually measured

## Updated Estimate

### Proof-of-Loop

Already achieved on the Mac.

Cost:
- low incremental compute cost
- some Anthropic judge cost for validation/evaluation

Why this matters:
- there is no longer a need to pay cloud GPU rent just to prove the loop exists

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

Not:
- H100 rental

Potential future reduction:
- some generation/filtering stages may shift from frontier models to local
  helper models on MSI, reducing both cash burn and latency for those stages

## Recommendation

Do not frame this as a 48-hour H100 experiment anymore.

Frame it as:
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
