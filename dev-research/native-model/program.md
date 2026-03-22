# Native Model Improvement Program

## Mission

Improve Plaited's native model behavior so it can generate Plaited-native UI,
modules, runtime wiring, and later tool-aware operating behavior end-to-end.

This program is not for general framework refactoring.
It is for improving the model that will operate inside Plaited's ontology:
- BP-first orchestration
- PM sovereignty
- MSS structural objects
- behavioral actors
- sub-agents and teams
- git + `.memory/` provenance
- constitution-aware execution

The work is now explicitly staged:

1. symbolic output quality
2. tool-aware process behavior
3. autonomous improvement loops

Do not collapse these stages together. The current program is still primarily
in Stage 1, but Stages 2 and 3 should already be oriented toward realistic
module and modnet outcomes rather than abstract framework-only behavior.

## Separation From Framework Program

This program is distinct from the framework dev autoresearch program.

- Framework program:
  - improves code, tooling, runtime, and harnesses
  - frontier models may be primary workers
- Native model program:
  - improves the behavior of the model that will become a Plaited-native producer
  - Falcon/self-distillation is expected to be primary over time

Do not merge these lanes casually.

## Core Hypothesis

Frontier coding agents can help build the school.
The native model must become the student and eventually the teacher.

Therefore:
- Codex/Claude outputs may be used to improve scaffolding
- Falcon/native-model outputs should become the preferred source for true
  Plaited-native distillation
- Stage 1 can use output-only distillation boundaries
- Stages 2 and 3 require increasing attention to tool traces, validation
  behavior, and improvement-loop structure

## Target Capabilities

Across all three stages, the native model should become strong at:

- generating modules end-to-end
- generating UI through Plaited's controller/generative UI model
- emitting BP-shaped coordination logic
- respecting constitution and boundary policy
- using `.memory/` and git history as working context
- deciding when to stay local vs. promote to actor/sub-agent/team
- reasoning in Plaited runtime terms rather than generic coding-agent terms

Stage-specific interpretation:

- **Stage 1: symbolic output quality**
  - prompt -> strong Plaited-native artifact
  - mostly prompt/output distillation
  - current focus
- **Stage 2: tool-aware process behavior**
  - inspect, edit, validate, revise
  - process/tool traces become training targets
  - tool use should increasingly be evaluated against real module outcomes,
    browser behavior, and non-technical UX quality
- **Stage 3: autonomous improvement loops**
  - breadth/depth coordination
  - compare, select, promote, and improve outcomes safely
  - loops should increasingly optimize for realistic module/modnet tasks, not
    only internal framework tasks

## Non-Goals

- broad framework rewrites
- generic coding benchmark chasing
- optimizing only for frontier-model style fluency
- training on every accepted framework diff by default

## Improvement Lanes

### Lane A: Framework Scaffolding

Data from external frontier models that improves:
- tooling
- runtime
- harnesses
- evals
- capture systems

This data may be useful but is not automatically native-model training data.

### Lane B: Native Producer Behavior

Data intended to teach the native model to:
- build modules
- build UI
- wire runtime behavior
- use constitution and BP semantics correctly

This is the priority lane for Falcon/self-distillation.

## Current Program Boundary

The active boundary is narrower than the long-term goal:

- current data collection is still mostly Stage 1
- validation prompts are manually authored
- retained outputs are manually curated into a stable training boundary
- local MLX runs on this Mac proved the loop but are no longer the intended
  execution path
- meaningful Falcon quality work is expected to move to the MSI machine

Do not mistake the current bootstrap loop for the full long-term native-model
training system.

Also do not mistake the current Stage 1 boundary for the eventual destination.
The long-term destination is not merely "a model that writes Plaited-flavored
code." It is a model that can help produce useful modnet modules and user
experiences with the right tool support and evaluation discipline.

## Machine Split

Current hardware roles:

- **This Mac**
  - validation
  - curation
  - data shaping
  - compare/report tooling
  - native-model control-plane and shared tooling work
- **MSI machine**
  - meaningful Falcon training
  - longer context
  - more trainable layers
  - repeated baseline vs tuned comparisons
  - later Stage 2 and Stage 3 work

## Slice Progression

- Slice 1: eval themes, rubric, and retained-output format design
- Slice 2: small-scale trial-based validation of eval design and output shape
- Slice 3: first executable native-model validation driver on top of the trial layer
- Slice 4: first local tuning path from the curated Stage 1 boundary
- Slice 5: baseline vs tuned comparison and success-metric evaluation
- Slice 6: Stage 1 data shaping and MSI-scale training refinement
- Slice 7: Stage 2 tool-aware module and browser process training
- Slice 8: Stage 3 autonomous improvement on realistic module/modnet tasks

## Execution Model

This lane should not default to the current bounded repo autoresearch harness.

Use the following execution split:

- `scripts/dev-autoresearch.ts`
  - for bounded framework code improvement inside the repo
  - stop-on-first-keep behavior is acceptable there
- `src/improve/trial.ts` and related trial infrastructure
  - for native-model validation, sampling, pass@k analysis, and retained-output
    collection
  - supports repeated prompt execution without pretending each attempt is a
    repo mutation

Native-model evaluation should primarily use the trial layer.
Repo autoresearch may still help with scaffolding around the lane, but it is
not the main collection engine.

Stage-specific execution:

- **Stage 1**
  - manually authored prompt batches
  - trial-layer validation
  - curated retained-output boundary
  - SFT/LoRA-style tuning
- **Stage 2**
  - process/tool capture becomes first-class data
  - validation behavior matters, not just final artifact quality
  - modules should increasingly be exercised in realistic environments:
    - browser execution where applicable
    - interaction and simulation loops
    - module-specific validation rather than only static output judgment
- **Stage 3**
  - breadth/depth coordination and promotion loops become training targets
  - the optimized objective should increasingly be realistic modnet/module
    success, not only framework-internal correctness

## Relationship To Modnet

`dev-research/modnet/` should remain a separate lane.

Reason:
- `runtime-taxonomy` is the lower-level local runtime ontology
- `modnet` is the higher-level inter-node, service, and product/outcome layer

However, the native-model stages should not stay framework-pure forever:

- Stage 1 can remain mostly framework- and symbolic-output-centered
- Stage 2 should begin shifting toward realistic module and UX outcomes
- Stage 3 should explicitly optimize coordinated improvement on realistic
  module/modnet tasks

So the lanes stay separate, but the destination for Stages 2 and 3 should be
closer to modnet/module reality than to isolated framework exercises.

## Data Provenance Requirements

Every candidate retained by this program should record:

- producer model
- judge model
- meta-verifier model
- improvement lane
- task type
- whether it produced:
  - code only
  - UI only
  - module only
  - end-to-end module + UI + runtime wiring
- whether it is suitable for:
  - framework improvement
  - native model distillation
  - UI/module generation corpus
  - constitution/governance corpus

The current contract boundary for that labeling lives in `src/improve/`:

- repo-improvement judging uses `RepoImprovementJudgeInputSchema`
  and repo-only outcomes
- trial-based judging uses `TrialJudgeInputSchema`
  and `TrialJudgeResultSchema`
- trial meta-verification uses `TrialMetaVerifierInputSchema`
  and `TrialMetaVerifierOutcomeSchema`

Retained-output suitability labels are:

- `framework-improvement`
- `native-model-distillation`
- `ui-module-generation-corpus`
- `constitution-governance-corpus`

## Acceptance Criteria

A retained candidate should be judged on:

- Plaited-native reasoning quality
- end-to-end module/UI correctness
- constitution/boundary compliance
- BP/runtime alignment
- usefulness as native-model distillation data

Passing framework tests alone is not sufficient.

For the current Stage 1 program, passing validation is also not sufficient on
its own. Outputs still need to be:

- Plaited-native enough to teach from
- distinct from generic coding-agent output
- suitable for curation into the stable training boundary

## Initial Eval Themes

Start with tasks like:

- generate a small module with matching UI and behavior
- generate runtime taxonomy-aware module actors
- produce controller-compatible UI for a user intent
- add constitution-aware bridge-code to a module
- use `.memory/` context to continue or revise a module
- choose actor vs sub-agent vs team correctly for a bounded task

## Distillation Policy

Default policy:

- Frontier-model framework traces:
  - retain selectively
  - mostly for scaffolding and eval construction
- Native-model traces:
  - preferred for true distillation if quality thresholds are met

Current practical policy:

- use manually curated retained outputs as the stable Stage 1 training boundary
- do not train directly from raw validation `results.jsonl`
- do not treat tiny local Mac LoRA wins as promotion evidence without baseline
  comparison
- do not treat local Mac LoRA runs as part of the forward execution plan unless
  they are needed to debug tooling
- move meaningful Falcon quality work to the MSI box before broadening Stage 1
  claims

## Safety

Do not allow the native model to self-modify its own grading policy,
distillation policy, or constitutional floor without separate approval and
stronger controls.
