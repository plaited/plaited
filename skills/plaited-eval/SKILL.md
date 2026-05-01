---
name: plaited-eval
description: CLI guidance for grading and comparing Plaited trial results with `plaited eval`.
license: ISC
compatibility: Requires bun
---

# Plaited Eval

CLI guidance for `plaited eval` grading and run comparison.

## When To Use

- Grade one Plaited trial with deterministic process checks and/or external graders
- Compare baseline and challenger eval bundles
- Preserve full snapshot evidence and task/result metadata in the output
- Integrate command- or JSON-based judge results into the same normalized output shape

## Command Discovery

```bash
bunx plaited --schema
bunx plaited eval --schema input
bunx plaited eval --schema output
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
- The eval CLI returns JSON only and does not choose a persistence location
- Harnesses should persist returned `EvalTrialResult` rows in their own run artifacts
- Use disposable `cwd` directories or worktrees because command graders may mutate files

Example:

```bash
bunx plaited eval '{
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

## Deterministic vs Judge Lanes

- Deterministic grading: use `process` graders
- LLM-as-judge integration: use `command` graders (external tool/model invocation) or `json`
  graders (precomputed judge result)
