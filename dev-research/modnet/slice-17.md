# Slice 17: Judge Ablation For Modnet Curation Gates

## Goal

Define and validate a judge-ablation lane for modnet curation work while
keeping the current Codex generation surface unchanged.

Document and preserve the current production split for modnet curation work:

- Codex for generation and implementation
- Sonnet as the primary judge
- Haiku as the meta-verifier

This slice is about evaluation design for judge replacement only, not changing
the generation-side Codex path.

## Why This Slice Exists

The current modnet lane uses:

- Sonnet as the primary judge
- Haiku as the meta-verifier

That is still the safest known stack for:

- raw-card inclusion/exclusion
- regenerated prompt seed review
- lower-scale derivation review

That remains the active production stack for this program.
Alternative generation-model and Codex `--oss` exploration are out of scope for
the current plan, but judge replacement work remains in scope.

## Scope

- `scripts/modnet-judge-ablation.ts`
- `scripts/modnet-judge-ablation.schemas.ts`
- `scripts/modnet-judge-ablation-report.ts`
- `scripts/tests/modnet-judge-ablation.spec.ts`
- `scripts/tests/modnet-judge-ablation-report.spec.ts`
- `dev-research/modnet/catalog/README.md`

## Fixed Requirements

- keep the current Sonnet + Haiku stack as the production default
- keep Codex as the active generation and implementation surface
- do not pursue Codex `--oss` or alternative generation-model migration from this slice
- judge ablation must run on a bounded held-out set first
- held-out set size is `100`
- use the same held-out set across all judge combinations
- keep the comparison reproducible:
  - fixed input file
  - fixed candidate rows
  - fixed rubric
- compare actual judgment outcomes, not just latency/cost

## Required Judge Matrix

At minimum, compare:

- `sonnet -> haiku`
  - current baseline
- `sonnet -> minimax_m2_7`
  - Haiku replacement candidate
- `sonnet -> minimax_m2_5`
  - cheaper Haiku replacement candidate
- `glm_5 -> haiku`
  - Sonnet challenger
- `kimi_k2_5 -> haiku`
  - Sonnet challenger

Optional follow-up:

- `qwen3_5_27b` as a prefilter before `sonnet -> haiku`

Second-phase Sonnet-replacement matrix should include:

- `deepseek_v3_2 -> minimax_m2_7`
- `nemotron_3_super_120b_a12b -> minimax_m2_7`
- `mistral_small_2603 -> minimax_m2_7`
- `kimi_k2_5 -> minimax_m2_7`
- `glm_5 -> minimax_m2_7`
- `minimax_m2_7 -> minimax_m2_7`

## Required Metrics

- schema-valid judgment rate
- schema-valid meta-verification rate
- agreement with the Sonnet + Haiku baseline
- agreement with hand-reviewed labels on the held-out set
- keep/discard precision
- modern-analog restraint
- family/structure drift rate
- cost per `100`
- wall-clock runtime per `100`

## Required Artifacts

- held-out set file:
  - `dev-research/modnet/catalog/modnet-judge-ablation-heldout.jsonl`
- per-run result file:
  - `tmp/modnet-judge-ablation.<label>.jsonl`
- comparison report:
  - `tmp/modnet-judge-ablation-report.json`

## Evaluation Policy

Use this slice to decide:

1. whether Haiku can be replaced
2. whether any candidate can safely challenge Sonnet as primary judge
3. whether a `qwen3.5-27b` prefilter is worth testing further

Promotion policy:

- replacing Haiku is easier than replacing Sonnet
- Codex remains unchanged on the generation side
- Sonnet should only be replaced if held-out quality is clearly as good or
  better on the metrics above

## Success Criteria

This slice succeeds if it produces a clear answer to one or more of:

- keep Sonnet + Haiku unchanged
- replace Haiku with a cheaper equal-quality meta-verifier
- identify a credible Sonnet challenger worth a second-phase test
- compare additional OpenRouter Sonnet challengers on the same held-out set
- validate whether `qwen3.5-27b` is useful only as a prefilter

## Deliverable

A documented judge-ablation lane that keeps Codex unchanged while testing
whether Sonnet or Haiku should be replaced for modnet curation.
