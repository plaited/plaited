# Slice 5: Evaluation & Success Metrics

## Target

Validate that a fine-tuned Falcon-family model shows measurable improvement
over baseline on Plaited-native evaluation tasks.

## Scope

- Run baseline and fine-tuned models on a held-out eval set
- Measure quality improvements (judge scores, meta-verify confidence)
- Validate success criteria for a go/no-go decision on the next iteration

## Required

- Baseline model
- Fine-tuned model from Slice 4
- Held-out eval set for Plaited-native tasks
- Sonnet judge and Haiku meta-verifier for scoring
- Evaluation script comparing baseline vs fine-tuned

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
- Fine-tuned judge score > baseline by ≥ 5% absolute
- Meta-verifier confidence increases by ≥ 3% absolute
- At least 80% of fine-tuned outputs show improvement over baseline

**No-Go:**
- Fine-tuned score < baseline or equal within noise
- Fine-tuned model produces worse trajectories or regressions

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

## Next Steps (if success)

- Scale data collection with the validated eval design
- Repeat fine-tuning with a larger curated corpus
- Re-run baseline vs fine-tuned evaluation before broadening the task set
