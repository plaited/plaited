---
name: plaited-eval
description: CLI guidance for grading, comparing, and calibrating Plaited trial results with `plaited eval`.
license: ISC
compatibility: Requires bun
metadata:
  plaited:
    kind: skill
    origin:
      kind: first-party
    capabilities:
      - id: workflow.eval-analysis
        type: workflow
        lane: private
        phase: validation
        audience: [analyst]
        actions: [grade, compare, calibrate]
        sideEffects: read-only
        source:
          type: first-party
---

# Plaited Eval

CLI guidance for `plaited eval` grading, run comparison, and grader calibration.

## When To Use

- Grade one Plaited trial with deterministic process checks and/or external graders
- Compare baseline and challenger eval bundles
- Sample eval bundle rows for grader calibration and human review
- Preserve full snapshot evidence and task/result metadata in the output
- Integrate command- or JSON-based judge results into the same normalized output shape

## Command Discovery

```bash
plaited --schema
plaited eval --schema input
plaited eval --schema output
```

## Grade Mode

`mode: "grade"` accepts exactly one trial per invocation plus an ordered grader list.

Key semantics:

- Canonical trial shape is `EvalTrial` with first-class `cwd` and full `snapshots: SnapshotMessage[]`
- `trial.task` uses `{ id, prompt, metadata? }`
- `trial.result` uses `{ status, message?, error?, metadata? }`
- `status: "completed"` requires `result.message`
- Terminal non-success (`failed`, `timed_out`, `cancelled`) forces overall `pass=false` and `score=0`
- Applicable graders still run for diagnostics, but cannot override terminal non-success or required failures
- `required` defaults to `true`; any non-skipped required grader with `pass !== true` fails the trial
- `weight` defaults to `1` and only affects the weighted score across non-skipped graders
- The eval CLI returns JSON only and does not choose a persistence location
- Harnesses should persist returned `EvalTrialResult` rows in their own run artifacts
- Use disposable `cwd` directories or worktrees because command graders may mutate files

Example:

```bash
plaited eval '{
  "mode": "grade",
  "trial": {
    "id": "trial-1",
    "cwd": "/tmp/run-1",
    "task": { "id": "task-1", "prompt": "Solve X" },
    "result": { "status": "completed", "message": "final answer" },
    "snapshots": []
  },
  "graders": [
    { "id": "process", "type": "process" },
    {
      "id": "judge-json",
      "type": "json",
      "result": { "pass": true, "score": 0.9, "reasoning": "meets rubric" }
    }
  ]
}'
```

## Grader Types

### `process`

Deterministic snapshot/status checks (`runtime_error`, `feedback_error`, `deadlock`, `selection`, `worker`).

Options:

- `failOnRuntimeError` (default `true`)
- `failOnFeedbackError` (default `true`)
- `failOnDeadlock` (default `true`)
- `failOnWorkerFailure` (default `true`)
- `maxSelections`
- `maxRepeatedSelectionType`

Worker snapshots fail when response has nonzero `exitCode`, `timedOut: true`, or non-null `signalCode`.

### `command`

Runs an exact `command: string[]` in `trial.cwd` using `Bun.spawn`.

- Commands may mutate `trial.cwd`; no automatic cleanup/reset is performed
- Graders execute sequentially in declared order
- Later command graders receive `previousResults` from earlier graders
- `when: "completed"` skips unless trial status is `completed`
- `timeoutMs` can bound execution time
- `maxOutputBytes` caps captured stdout+stderr bytes; default is `256000`

Stdin payload (JSON):

```json
{
  "trial": { "...": "EvalTrial" },
  "grader": { "...": "Current grader config" },
  "previousResults": [{ "...": "Prior EvalGraderResult rows" }]
}
```

Output modes:

- `exit_code` (default): pass iff exit code is 0, score is 1/0
- `grader_json`: stdout must be normalized grader JSON (`{ pass, score, reasoning?, outcome?, metadata? }`)

If `grader_json` command exits nonzero or stdout is invalid JSON/schema, grader returns failed result with
captured command outcome (stdout/stderr/exit) and the top-level CLI still succeeds.

### `json`

Passive inline grader result. No command execution and no built-in LLM call.
Useful when an upstream harness already produced external judge output.

## Compare Mode

`mode: "compare"` consumes eval run bundles:

```json
{
  "label": "baseline",
  "tasks": [
    {
      "taskId": "task-1",
      "metadata": {},
      "trials": ["EvalTrialResult", "..."]
    }
  ]
}
```

Semantics:

- Validates `trials[].trial.task.id === taskId` for every task row
- Does not require equal trial counts between baseline/challenger
- A task is comparable when both sides have at least one trial
- Per-task rows include baseline/challenger trial counts
- Metrics include `passRate` and `avgScore`
- If `k` is provided and enough trials exist, includes:
  - `estimatedPassAtK = 1 - (1 - passRate)^k`
  - `estimatedPassAllK = passRate^k`
- Output includes baseline metrics, challenger metrics, per-task rows, and summary
  `baselineWins/challengerWins/ties/insufficientData`

## Calibrate Mode

`mode: "calibrate"` samples an eval run bundle for reviewing grader quality. It
does not run graders; it consumes existing `EvalTrialResult` rows from `grade`.

Use it when:

- Auditing false accepts/rejects from external judges
- Building a human review queue for a specific grader
- Inspecting representative failures without returning every snapshot from every trial
- Checking required-vs-optional grader failure patterns across a bundle

Input fields:

- `bundle`: one eval run bundle
- `focus`: `required_failures` (default), `all_failures`, or `all`
- `sample`: requested sample size, default `20`, max `1000`
- `seed`: optional deterministic sampling seed
- `graderId`: optional focused grader id
- `snapshotMode`: `diagnostic` (default) or `all`
- `maxSnapshotsPerSample`: default `8`, used only by diagnostic snapshot selection

Focus semantics:

- `required_failures` without `graderId`: completed trials with at least one failed required grader
- `required_failures` with `graderId`: completed trials where that required grader executed and failed
- `all_failures` without `graderId`: any trial whose overall `pass` is false
- `all_failures` with `graderId`: trials where that grader executed and failed
- `all` without `graderId`: completed trials
- `all` with `graderId`: completed trials where that grader exists and was not skipped

Sampling semantics:

- Sampling is deterministic for the same resolved seed and input bundle
- If `seed` is omitted, the seed is derived from bundle label, focus, grader id,
  sample size, snapshot mode, and snapshot limit
- `focus: "all"` balances pass/fail candidates where available; failure-focused
  modes shuffle candidates and take the requested sample
- If the candidate pool is smaller than `sample`, output includes a warning and
  returns all candidates
- Unknown `graderId` fails the command

Snapshot semantics:

- Samples always include `source` pointers: bundle label, task index, trial index,
  task id, and trial id
- `sample.trial` omits full `trial.snapshots`; selected snapshots are returned in
  `sample.snapshots`
- `snapshotMode: "diagnostic"` includes first/early snapshots, runtime errors,
  feedback errors, deadlocks, worker failures, tail snapshots, then midpoint
  snapshots up to `maxSnapshotsPerSample`
- `snapshotMode: "all"` includes full snapshots per selected sample and emits a
  large-output warning

Output includes:

- `bundleSummary`, `candidateSummary`, and `sampleSummary`
- required/optional executed/pass/fail/skipped grader outcome counts
- focused grader executed pass/fail, skipped, and missing counts when `graderId` is set
- per-sample `process`, `graderResults`, `focusedGraderResult`,
  `failedGraders`, and `failedRequiredGraders`
- `reviewProtocol` and `reviewResponseContract`

Reviewer labels:

- `correct_accept`
- `incorrect_accept`
- `correct_reject`
- `incorrect_reject`
- `ambiguous`
- `needs_human`

The review contract requires `label`, `confidence`, and `reasoning`.
Use `needsHumanReason` when `label` is `needs_human`.

Example:

```bash
plaited eval '{
  "mode": "calibrate",
  "bundle": { "label": "candidate-run", "tasks": [] },
  "focus": "all_failures",
  "sample": 25,
  "seed": "review-2026-05-07",
  "graderId": "judge-json",
  "snapshotMode": "diagnostic",
  "maxSnapshotsPerSample": 8
}'
```

## Deterministic vs Judge Lanes

- Deterministic grading: use `process` graders
- LLM-as-judge integration: use `command` graders (external tool/model invocation) or `json`
  graders (precomputed judge result)
- Human judge calibration: use `calibrate` on persisted grade results; store reviewer
  responses next to the run artifact that provided the bundle
