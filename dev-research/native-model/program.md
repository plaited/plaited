# Native Model Improvement Program

## Mission

Improve Plaited's native model behavior so it can generate Plaited-native UI,
modules, and runtime wiring end-to-end.

This program is not for general framework refactoring.
It is for improving the model that will operate inside Plaited's ontology:
- BP-first orchestration
- PM sovereignty
- MSS structural objects
- behavioral actors
- sub-agents and teams
- git + `.memory/` provenance
- constitution-aware execution

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

## Target Capabilities

The native model should become strong at:

- generating modules end-to-end
- generating UI through Plaited's controller/generative UI model
- emitting BP-shaped coordination logic
- respecting constitution and boundary policy
- using `.memory/` and git history as working context
- deciding when to stay local vs. promote to actor/sub-agent/team
- reasoning in Plaited runtime terms rather than generic coding-agent terms

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

## Slice Progression

- Slice 1: eval themes, rubric, and retained-output format design
- Slice 2: small-scale trial-based validation of eval design and output shape
- Slice 3: first executable native-model validation driver on top of the trial layer
- Later slices: result curation, Falcon fine-tuning, and success-metric evaluation

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

## Safety

Do not allow the native model to self-modify its own grading policy,
distillation policy, or constitutional floor without separate approval and
stronger controls.
