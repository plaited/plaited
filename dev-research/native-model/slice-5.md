# Slice 5: Evaluation & Success Metrics

## Target

Validate that fine-tuned Falcon 7B shows measurable improvement over baseline on Plaited-native evaluation tasks.

## Scope

- Run Falcon baseline and fine-tuned on held-out eval set
- Measure quality improvements (judge scores, meta-verify confidence)
- Calculate cost-per-quality-output for PoC
- Validate success criteria for go/no-go decision on Phase 2

## Required

- Falcon 7B baseline model
- Fine-tuned Falcon 7B from Slice 4
- Held-out eval set: `/dev-research/native-model/evals/test-cases.jsonl` (~100-200 examples)
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
- Falcon fine-tuned judge score > baseline by ≥ 5% absolute
- Meta-verifier confidence increases by ≥ 3% absolute
- Cost per quality output (PoC) < $5
- At least 80% of fine-tuned outputs show improvement over baseline

**No-Go:**
- Fine-tuned score < baseline or equal within noise
- Cost per quality output > $10
- Fine-tuned model produces worse trajectories or regressions

## Evaluation Results

**Metrics to report:**

| Metric | Baseline | Fine-Tuned | Delta | Status |
|--------|----------|-----------|-------|--------|
| Judge score (avg) | ? | ? | +/-% | ✓/✗ |
| Meta confidence (avg) | ? | ? | +/-% | ✓/✗ |
| Pass rate (> 0.85) | ?% | ?% | +/-pp | ✓/✗ |
| Cost per quality output | ~$4.70 | ? | -$? | ✓/✗ |

**Cost breakdown (PoC):**
- 3K trials collection: $140-160 (Sonnet/Haiku judging)
- Falcon fine-tuning: $0 (local, electricity only)
- Evaluation: $30-50 (100 evals × judge + meta-verify)
- **Total PoC cost: ~$170-210**
- **Cost per quality output: $170 / ~300 good outputs = ~$0.57**

## Next Steps (if success)

- **Phase 2:** Scale to 8K trials on same hardware (cost: ~$300-400)
- **Phase 3:** Evaluate Phase 2 Falcon, iterate if improvement continues
- **Production:** Train full model on 20K+ trials, validate on broader benchmarks
