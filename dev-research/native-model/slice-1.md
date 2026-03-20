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

## Eval Themes

**1. Module Generation (BP-shaped)**
- Generate a Plaited module with BP-shaped actors and UI

**2. UI Generation (Controller-compatible)**
- Generate controller-compatible UI for a Plaited intent

**3. Runtime Wiring (Coordination)**
- Emit coordination logic with correct behavioral thread semantics

**4. Constitution & Memory**
- Add constitution-aware bridge-code that respects `.memory/` conventions

**5. Actor vs Sub-Agent Decision**
- Decide whether task X should be actor, sub-agent, or team and justify it

**6. Plaited-Native Refactoring**
- Refactor a module using git history and `.memory/` as context

## Judge Rubric

Dimensions (0-1 scale):

- **Architecture:** follows Plaited patterns (BP, PM, MSS, constitution)
- **Boundedness:** stays focused on one coherent concern
- **Focus:** addresses the task intent without bloat
- **Quality:** implementation correctness and completeness

## Meta-Verifier Rubric

- **Consistency:** reasoning matches the produced result
- **Risk:** important gaps or safety issues are surfaced
- **Confidence:** confidence in the primary judge's assessment

## Output

This slice should produce a documented eval plan covering:
- eval themes
- judge rubric
- meta-verifier rubric
- retained-output structure
- criteria for the next validation slice
