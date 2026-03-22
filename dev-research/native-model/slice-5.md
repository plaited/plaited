# Slice 5: Evaluation & Success Metrics

## Target

Validate that a fine-tuned Falcon-family model shows measurable improvement
over baseline on Plaited-native evaluation tasks before promotion.

## Scope

- Run baseline and fine-tuned models on a held-out eval set
- Measure quality improvements (judge scores, meta-verify confidence)
- Validate success criteria for a go/no-go decision on the next iteration
- Keep the current policy grounded in Stage 1 symbolic-output evaluation

## Required

- Baseline model
- Fine-tuned model from Slice 4
- Held-out eval set for Plaited-native tasks
- Sonnet judge and Haiku meta-verifier for scoring
- Evaluation script comparing baseline vs fine-tuned
- Explicit no-promotion-on-regression rule

## Preserve

- Test set integrity (no overlap with training data from Slice 3)
- Judge/meta-verifier logic unchanged from training
- Reproducibility (same prompts, same grader for both models)

## Avoid

- Evaluating on training data (defeats the purpose)
- Changing judge thresholds between baseline and fine-tuned
- Overstating improvements if they're within noise margin (< 5% improvement)
- Assuming one good eval set proves the model

## Acceptance Criteria

**Success (Go for Phase 2):**
- Fine-tuned output does not regress the agreed baseline metrics
- Fine-tuned output shows clear enough improvement to justify promotion
- Improvement is visible on the held-out task set, not only in training logs

**No-Go:**
- Fine-tuned score < baseline or equal within noise
- Fine-tuned model produces worse trajectories or regressions
- Fine-tuned run only proves loop execution without real quality gains

## Evaluation Results

**Metrics to report:**

| Metric | Baseline | Fine-Tuned | Delta | Status |
|--------|----------|-----------|-------|--------|
| Judge score (avg) | ? | ? | +/-% | ✓/✗ |
| Meta confidence (avg) | ? | ? | +/-% | ✓/✗ |
| Pass rate (> 0.85) | ?% | ?% | +/-pp | ✓/✗ |

**Optional cost reporting:**
- trial collection cost
- fine-tuning compute cost
- evaluation cost

## Eval-Set Expectations

The held-out eval set should:

- be represented in the same general task language as Slice 1 themes
- not overlap with the curated training set from Slice 3
- be executable through the same trial/eval substrate used for validation
- include enough cases to expose regressions, not just best-case wins

## Current Practical Reading

The first local Mac comparison already showed:

- a successful quantized bootstrap LoRA run can complete
- tuned versus untuned local Falcon did not improve pass rate
- average score regressed slightly

Therefore this slice should currently be read as:

- baseline vs tuned comparison is mandatory before promotion
- bootstrap success is not the same as model success
- meaningful promotion attempts should move to the MSI machine once Stage 1
  data shaping and training headroom improve

## Next Steps (if success)

- Scale data collection with the validated eval design
- Repeat fine-tuning with a larger curated corpus
- Re-run baseline vs fine-tuned evaluation before broadening the task set
