# Eval Hill-Climbing Model

## Why This Exists

This page documents the current hill-climbing support model implemented in
`src/eval/*`: how single Plaited agent attempts are graded, how graded trials
are bundled, and how baseline/challenger runs are compared.

This page is grounded in the current implementations and tests at:

- `src/eval/eval.schemas.ts`
- `src/eval/eval.ts`
- `src/eval/tests/eval.spec.ts`

## Current Layering

Layer 1: trial evidence

- A harness produces one `EvalTrial` per agent attempt.
- `cwd` is first-class because command graders execute in that working
  directory.
- `snapshots: SnapshotMessage[]` is the canonical trajectory evidence and is
  retained in the graded result.
- `task` describes what the agent was asked to do.
- `result` describes the terminal harness outcome.

Layer 2: grading

- `plaited eval` with `mode: "grade"` grades exactly one trial.
- Process graders derive deterministic diagnostics from snapshots.
- Command graders run external checks or judge scripts in `trial.cwd`.
- JSON graders carry precomputed grader results from an upstream harness.
- Terminal non-success trial statuses force overall `pass=false` and `score=0`,
  while applicable graders still run for diagnostic output.

Layer 3: comparison

- `plaited eval` with `mode: "compare"` consumes baseline/challenger eval run
  bundles.
- Bundles group `EvalTrialResult[]` rows by `taskId`.
- Each `trials[].trial.task.id` must match the containing `taskId`.
- Comparison does not require equal trial counts; it reports counts and uses
  normalized rates.

## Canonical Evidence Policy

Current policy is graded-trial first:

1. `EvalTrialResult.pass` is canonical pass evidence for comparison.
2. `EvalTrialResult.score` is the normalized weighted grader score.
3. Required non-skipped graders gate trial pass.
4. Optional judge graders can affect score but cannot override required
   deterministic failures.
5. Non-success trial statuses (`failed`, `timed_out`, `cancelled`) force
   overall failure regardless of grader output.
6. Skipped graders are retained for diagnostics but excluded from pass gating
   and score aggregation.

## Metric Semantics

Comparison metrics use clear names:

- `passRate = passingTrials / trialCount`
- `avgScore = mean(trials[].score)`
- `estimatedPassAtK = 1 - (1 - passRate)^k`
- `estimatedPassAllK = passRate^k`

`estimatedPassAtK` estimates the chance that at least one of `k` attempts
passes. `estimatedPassAllK` estimates the chance that all `k` attempts pass.

## How This Supports Hill Climbing

Fast inner-loop objective:

- Run repeated attempts per task in isolated working directories.
- Grade each attempt into an `EvalTrialResult`.
- Compare baseline and challenger bundles by pass rate, score, and per-task
  winners.

Reliability objective:

- Repetition (`k`) estimates stochastic reliability.
- `estimatedPassAtK` measures rescue-by-retry behavior.
- `estimatedPassAllK` measures consistency.
- Per-task insufficient data remains visible when only one side has evidence.

Why grading and orchestration are separated:

- `src/eval` does not run the agent or choose artifact storage.
- Harnesses own attempt scheduling, worktree isolation, and persistence.
- `plaited eval` owns the stable JSON grading/comparison contract.

## Current Limits

Current code does not yet provide:

- An outer search/orchestration loop for hill climbing.
- Promotion policy thresholds such as minimum task count or minimum win delta.
- Confidence intervals or bootstrap resampling for noisy comparisons.
- Built-in model-provider calls for LLM-as-judge grading.

## Operational Guidance

For early hill-climbing operation:

- Treat `plaited eval` as evidence normalization and comparison support, not an
  autonomous research orchestrator.
- Use disposable `cwd` directories because command graders may mutate files.
- Start with deterministic required graders for type checks, tests, and process
  health.
- Add LLM-as-judge through command graders or JSON graders after deterministic
  checks are stable.
- Keep `k` modest for inner-loop screening, then raise `k` for candidate
  promotion studies.

After early runs, inspect:

- `summary.insufficientData`
- per-task winner distribution (`baseline`, `challenger`, `tie`,
  `insufficient_data`)
- `passRate`, `avgScore`, `estimatedPassAtK`, and `estimatedPassAllK`
- process diagnostics such as runtime errors, feedback errors, deadlocks, and
  worker failures
