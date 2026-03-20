# Slice 1: Foundation - Test Cases & Rubric

## Target

Establish test case collection and evaluation rubric for Lane B (native producer behavior) that guides 3K trials toward high-quality Plaited-native code.

## Scope

- Generation prompts for 8 eval themes (modules, UI, runtime, constitution, memory, decisions)
- Judge/meta-verifier rubric tailored to Plaited-native reasoning
- Success thresholds for training data suitability
- No code generation yet (Slice 2 is execution)

## Required

- 8 distinct eval theme prompt templates (one per worker to parallelize)
- Judge rubric with scoring dimensions: architecture, boundedness, focus, quality
- Meta-verifier rubric: consistency, risk, confidence
- Clear success criteria: judge score > 0.85, confidence > 0.8, richness = full
- Task categorization: modules, UI, bridge-code, actor decisions, combinations

## Preserve

- Eval themes remain specific to Plaited (BP, PM, MSS, constitution, memory)
- Do not optimize for generic coding benchmarks
- Rubric reflects Lane B focus (native producer), not framework scaffolding
- Judge thresholds remain externally governed, not self-modified

## Avoid

- Overfitting prompts to one model or eval harness
- Vague eval themes that conflate framework scaffolding (Lane A) with producer behavior (Lane B)
- Judge thresholds so high that < 5% of outputs pass (data collection starves)
- Judge thresholds so low that > 50% of outputs pass (quality degraded)

## Acceptance Criteria

- 8 eval themes defined with example prompts
- Judge rubric documented with scoring examples
- Meta-verifier rubric documented with consistency/risk/confidence definitions
- Success threshold defined: expected pass rate 10-30% (tunable after pilot)
- All slices 2A-2H can reference these without modification
- Validation passes

## Notes

- Eval themes should be simple enough for 375 attempts per worker
- Expect ~10-20% of outputs to clear judge > 0.85 threshold (300 good outputs from 3K trials)
- If pass rate is < 5%, iterate rubric (too strict); if > 50%, iterate rubric (too lenient)
- Store test cases in JSONL format for easy iteration
