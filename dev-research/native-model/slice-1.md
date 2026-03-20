# Slice 1: Eval Design Foundation

## Target

Define the initial eval themes, judge/meta-verifier rubric, and retained-output
format for the native-model lane.

This slice is a specification and planning step.
It is not a keep/revise/discard autoresearch run.

## Scope

- define the first eval themes for Lane B
- define judge and meta-verifier dimensions and thresholds
- define the retained-output format for later curation and training
- identify what must be validated before any large-scale collection starts

## Required

- Plaited-specific eval themes for native-model work
- explicit judge rubric
- explicit meta-verifier rubric
- explicit retained-output shape for later curation
- clear success criteria for the next validation step

## Preserve

- eval themes remain Plaited-specific (BP, PM, MSS, constitution, memory)
- judge thresholds externally governed (not self-modifying)
- eval design optimized for Plaited-native reasoning, not generic coding

## Avoid

- conflating Lane A (scaffolding) with Lane B (native producer)
- assuming the current autoresearch harness should generate eval prompts
- overfitting the eval plan to one model or one run

## Acceptance Criteria

- eval themes are documented clearly enough for later validation
- judge rubric is documented with explicit dimensions and thresholds
- meta-verifier rubric is documented with explicit dimensions and thresholds
- retained-output format is defined for later curation and training
- the next slice can validate the eval design without requiring
  prompt-generation autoresearch

## Eval Design Principles

- Prefer Plaited-native tasks over generic coding benchmarks.
- Prefer tasks that require end-to-end reasoning across structure, runtime,
  UI, and governance.
- Treat module generation as the primary evaluation center of gravity.
- Reuse existing Plaited prompt assets where possible instead of inventing
  synthetic benchmark families from scratch.
- Keep external web research optional and secondary to repo-grounded tasks.

## Eval Themes

The first validation set should be organized around these eight themes.

**1. MSS-grounded module generation**
- Generate a small Plaited module with correct MSS tags, package structure,
  and agent-facing guidance.
- Seed from:
  - `skills/modnet-modules/assets/prompts.jsonl`
  - `skills/mss-vocabulary/`

**2. Controller-compatible UI generation**
- Generate controller-compatible UI for a bounded user intent.
- Must align with Plaited's generative UI/controller model rather than generic
  SPA assumptions.

**3. Runtime wiring and BP coordination**
- Emit runtime wiring with correct behavioral thread semantics, event flow,
  and link usage.
- Must use Plaited runtime concepts rather than generic async orchestration.

**4. Constitution-aware module or bridge-code changes**
- Add or revise bridge-code that respects constitution, boundary policy, and
  PM authority.

**5. Memory-aware continuation**
- Continue or revise work using `.memory/` and git history as working context,
  not as dead attachments.

**6. Actor vs sub-agent vs team choice**
- Decide whether a bounded task should remain local, become an actor, be
  delegated to a sub-agent, or require a team.
- Justification is part of the evaluation.

**7. Plaited-native refactoring**
- Refactor an existing module or runtime surface while preserving its
  Plaited-native semantics.

**8. End-to-end module plus UI plus runtime composition**
- Produce a coherent result that connects structure, UI, and runtime wiring
  together instead of solving them in isolation.

## Theme Packaging

For each theme, the retained eval case should eventually record:

- `theme_id`
- `theme_name`
- `task_type`
- `difficulty`
- `seed_source`
- `prompt`
- optional `hint`
- expected evaluation dimensions
- whether the task is intended for:
  - native-model distillation
  - framework-only scaffolding
  - mixed review but not distillation

## Judge Rubric

The primary judge should score each candidate on a 0-1 scale across these
dimensions.

- **Plaited Alignment**
  - Uses BP, PM, MSS, constitution, `.memory/`, and node concepts correctly.
- **Task Fulfillment**
  - Solves the stated task without drifting into unrelated output.
- **Structural Correctness**
  - Produces correct files, schemas, tags, and module/runtime shape.
- **Dynamic Correctness**
  - Runtime/UI behavior is plausible and internally coherent.
- **Distillation Suitability**
  - The output is clean and informative enough to be useful training data.

### Judge Thresholds

- `retain_for_review`
  - overall score `>= 0.80`
  - no single dimension `< 0.65`
- `retain_for_distillation`
  - overall score `>= 0.85`
  - `Plaited Alignment >= 0.85`
  - `Distillation Suitability >= 0.85`
- `reject`
  - overall score `< 0.80`
  - or any critical dimension `< 0.65`

The judge should also emit short free-text reasons for:

- strongest success
- most important flaw
- whether the output is:
  - scaffolding-only
  - native-distillation-eligible
  - unsuitable for retention

## Meta-Verifier Rubric

- **Consistency**
  - The judge's explanation matches the actual output.
- **Risk**
  - Safety, architecture, or evaluation risks are surfaced honestly.
- **Confidence**
  - Confidence that the judge result is safe to trust for curation decisions.

### Meta-Verifier Thresholds

- `trust_high`
  - confidence `>= 0.85`
  - risk `<= 0.20`
- `trust_with_review`
  - confidence `>= 0.75`
  - risk `<= 0.35`
- `do_not_retain_without_human_review`
  - confidence `< 0.75`
  - or risk `> 0.35`

## Retained-Output Format

Retained outputs for later curation should be captured in JSONL with fields
like:

```json
{
  "id": "native-eval-001",
  "theme_id": "module-generation",
  "task_type": "module_ui_runtime",
  "producer_model": "codex-cli",
  "judge_model": "claude-sonnet",
  "meta_verifier_model": "claude-haiku",
  "improvement_lane": "native_producer_behavior",
  "prompt": "...",
  "output_summary": "...",
  "artifact_paths": [],
  "judge": {
    "overall_score": 0.88,
    "dimensions": {
      "plaited_alignment": 0.90,
      "task_fulfillment": 0.87,
      "structural_correctness": 0.86,
      "dynamic_correctness": 0.84,
      "distillation_suitability": 0.91
    },
    "retention_label": "retain_for_distillation"
  },
  "meta_verifier": {
    "confidence": 0.89,
    "risk": 0.12,
    "consistency": 0.92,
    "trust_label": "trust_high"
  },
  "suitability": {
    "framework_improvement": false,
    "native_model_distillation": true,
    "ui_module_corpus": true,
    "constitution_governance_corpus": false
  }
}
```

At minimum, retained outputs must preserve:

- task and theme identity
- producer/judge/meta-verifier provenance
- judge dimension scores and retention label
- meta-verifier trust signal
- suitability labels for later curation

## Slice 2 Validation Plan

Slice 2 should validate this design with a small manual or semi-manual sample:

- 1 to 2 cases per theme
- mixed difficulty
- direct execution against real tasks
- no prompt-generation autoresearch loop

Slice 2 should answer:

- are the themes distinct enough to avoid collapse into one generic task type?
- do the judge dimensions separate good Plaited-native outputs from generic
  but plausible coding outputs?
- do the retained-output fields capture enough signal for later curation?
- which themes are immediately good distillation candidates versus only useful
  for scaffolding?

## External Research Inputs

External research APIs such as You.com Search or Research can be useful later
for:

- finding public product/task patterns
- collecting realistic user-intent phrasing
- grounding domain-specific prompts

They should not define the Slice 1 foundation.
Slice 1 should be anchored in Plaited's own ontology, current skills, runtime
surfaces, and module patterns first.

## Output

This slice should produce a documented eval plan covering:
- eval themes
- judge rubric
- meta-verifier rubric
- retained-output structure
- criteria for the next validation slice
