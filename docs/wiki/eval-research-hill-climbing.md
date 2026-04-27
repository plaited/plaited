# Eval + Research Hill-Climbing Model

## Why This Exists

This page documents the current hill-climbing support model implemented in `src/eval/*` and `src/research/*`: what is canonical, what is derived, and how promotion decisions are made today.

This page is grounded in the current implementations and tests at:

- `src/eval/eval.schema.ts`
- `src/eval/eval.process.ts`
- `src/eval/tests/eval.process.spec.ts`
- `src/research/research.schema.ts`
- `src/research/research.grading.utils.ts`
- `src/research/research.comparison.utils.ts`
- `src/research/research.cli.ts`
- `src/research/tests/*`

## Current Layering

Layer 1: `src/eval` (per-trial evidence and process diagnostics)

- Defines snapshot-native trace and process summary shapes (`PlaitedTraceSchema`, `TrialProcessSummarySchema`).
- Computes per-trial diagnostics such as deadlock/feedback/runtime error detection and selection-pattern summaries.
- Produces trial evidence that downstream grading/comparison can trust as run-level facts.

Layer 2: `src/research` (run normalization, comparison, promotion)

- Normalizes each prompt result for comparability (`normalizeResearchPromptResult`).
- Compares baseline/challenger runs (`compareResearchRuns`) and classifies each prompt winner.
- Selects promotion action (`selectPromotionDecision`) from comparison output and thresholds.

## Comparison And Promotion Policy

Current policy is trial-evidence first:

1. Canonical pass evidence is `trials[].pass` (`boolean`) on each prompt result.
2. Full `trials[].pass` coverage for `k` trials is required for prompt-level comparability.
3. Partial coverage or zero coverage is non-comparable and yields `insufficient_data` winner classification.
4. Cached aggregates (`passRate`, `passAtK`, `passExpK`) are treated as derived cache fields, not canonical truth.
5. When full trial evidence exists, comparison normalizes aggregates from `trials[].pass` even if cached values disagree.
6. Run-level pass metrics are computed from comparable prompts only (`comparablePromptCount` controls metric inclusion).

Promotion policy in `selectPromotionDecision`:

- If no comparable prompts exist, keep baseline.
- Otherwise evaluate:
  - `winDelta = challengerWins - baselineWins`
  - `passRateDelta = challenger.avgPassRate - baseline.avgPassRate`
  - `passAtKDelta = challenger.avgPassAtK - baseline.avgPassAtK`
- Promote challenger only when gate conditions pass:
  - wins gate (`winDelta >= minWinDelta`) or tie-break gate (`winDelta === 0` and positive deltas),
  - and quality gate (`passRateDelta >= minPassRateDelta`).

## Metric Semantics

Current formulas (from normalization logic and tests):

- `passRate = passes / k`
- `passAtK = 1 - (1 - passRate)^k`
- `passExpK = passRate^k`

Where `passes` counts `true` values in canonical `trials[].pass` evidence.

## How This Supports Hill Climbing

Fast inner-loop objective:

- Run repeated trials per prompt (`k`) and normalize to stable prompt-level pass metrics.
- Use per-prompt winners and aggregate deltas for quick baseline/challenger iteration.

Promotion/reliability objective:

- Promotion is gated by both comparative wins and quality deltas, not by one metric alone.
- `insufficient_data` classification prevents promotion from cached or partial evidence.

Where repetition fits:

- Repetition (`k`) is the mechanism to estimate reliability under stochastic behavior.
- Higher `k` gives more stable pass-rate estimates and reduces accidental promotions.

Why trial evidence and run comparison are separated:

- `src/eval` captures/diagnoses trial process truth.
- `src/research` enforces normalization/comparability and promotion policy.
- This separation keeps evidence collection independent from selection policy tuning.

## Current Limits

Current code does not yet provide:

- An outer search/orchestration loop for hill climbing (mutation, scheduling, automated rollout control).
- A configurable minimum comparable-prompt threshold gate for promotion (beyond the built-in "must have at least one comparable prompt").
- A richer hill-climbing metadata model (for example strategy lineage, mutation IDs, or policy provenance history).

## Recommended Next Steps

Priority 1: run real baseline/challenger studies before tightening policy.

- Capture distributions of `comparablePromptCount`, `insufficientData`, `winDelta`, `passRateDelta`, and `passAtKDelta`.
- Verify how often candidate runs fail comparability due to missing `trials[].pass`.

Priority 2: tune promotion thresholds from observed data, not static assumptions.

- Adjust `minWinDelta` and `minPassRateDelta` only after seeing real variance and CI behavior.
- Monitor false-positive promotions (promoted but later regresses) before raising aggressiveness.

Priority 3: add explicit comparability sufficiency controls.

- Add `minComparablePromptCount` or ratio-based gate to research CLI/policy.
- Keep `insufficient_data` counts visible in decision reasons.

Priority 4: extend metadata for future hill-climbing analysis.

- Add structured run metadata for candidate lineage, config fingerprint, and trial-policy context.
- Keep trial-evidence canonicality rules unchanged as metadata expands.

## Operational Guidance

For early hill-climbing operation:

- Treat this stack as evidence normalization + promotion support, not a full auto-research orchestrator.
- Start with a first real run set before hard-coding a minimum comparable-prompt threshold.
- Keep `k` modest for fast inner-loop screening, then raise `k` for promotion candidates.

After early runs, inspect:

- `summary.insufficientData` and each run's `comparablePromptCount`.
- Per-prompt winner distribution (`baseline` / `challenger` / `tie` / `insufficient_data`).
- `avgPassRate`, `avgPassAtK`, and corresponding confidence intervals.
- Eval process diagnostics (`deadlockDetected`, `feedbackErrorDetected`, `runtimeErrorDetected`) for regressions hidden by headline pass metrics.
