---
name: eval
description: Grade, compare, and calibrate Plaited trial results with the in-process SDK util.
license: ISC
compatibility: Requires bun
---

# Eval

In-process SDK utilities for grading, comparing, and calibrating trial results.

The eval API lives in two layers:

- **Generic core** (`src/eval/`) — `gradeEvalTrial`, `compareEvalRuns`, `calibrateEvalRun`, `buildEvalTrial`. Zero dependency on the behavioral runtime. Works with any event type via the `EvalTrial<TEvents>` generic.
- **Behavioral bridge** (`src/eval/process-grader.ts`) — `summarizeEvalTrialProcess`, `processGrader`, `isSnapshotDiagnostic`. Depends on `SnapshotMessage` and the behavioral runtime.

## When To Use

- Grade a trial with deterministic checks, external command graders, or in-process function graders
- Compare baseline and challenger eval run bundles
- Sample an eval bundle for grader calibration and human review
- Build a custom eval harness for a pi extension or other SDK without subprocess overhead

## Canonical Flow

```
capture → grade → compare → calibrate
```

1. **Capture** — collect trial events and result metadata into an `EvalTrial<TEvents>`
2. **Grade** — run `gradeEvalTrial({ trial, graders })` to produce an `EvalTrialResult`
3. **Compare** — use `compareEvalRuns({ baseline, challenger })` to compare run bundles
4. **Calibrate** — use `calibrateEvalRun({ bundle, ... })` to sample for grader review

## Core API

### `buildEvalTrial`

```ts
import { buildEvalTrial } from 'plaited/eval'

const trial = buildEvalTrial({
  id: 'trial-1',
  cwd: '/tmp/run-1',
  task: { id: 'task-1', prompt: 'Solve X' },
  result: { status: 'completed', message: 'final answer' },
  events: [/* your typed event stream */],
  metadata: { model: 'gpt-4', runId: 'abc-123' },
})
```

Validates that `completed` status includes a `message`. Other statuses are accepted as-is.

### `gradeEvalTrial`

```ts
import { gradeEvalTrial } from 'plaited/eval'

const result = await gradeEvalTrial({
  trial,
  graders: [
    { id: 'process', type: 'json', result: { pass: true, score: 1 } },
    { id: 'check-output', type: 'command', options: { command: ['node', 'check.mjs'] } },
    {
      id: 'custom-judge',
      type: 'function',
      run: (ctx) => {
        const { trial, previousResults } = ctx
        // custom logic using trial.events
        return { pass: true, score: 0.9, reasoning: 'meets rubric' }
      },
    },
  ],
})
```

Grader types:

| Type | Description |
|------|-------------|
| `json` | Passive inline result from an upstream harness |
| `command` | External process via `Bun.spawn` with trial context on stdin |
| `function` | In-process TypeScript function receiving `{ trial, previousResults }` |

Semantics:
- Graders execute sequentially in declared order
- `previousResults` are threaded to later graders (available in `function` and `command` graders)
- `when: 'completed'` skips the grader unless trial status is `completed`
- `required` (default `true`): any non-skipped required grader with `pass !== true` fails the trial
- `weight` (default `1`): affects weighted score computation
- Terminal non-success (`failed`, `timed_out`, `cancelled`) forces overall `pass=false` and `score=0`

### `compareEvalRuns`

```ts
import { compareEvalRuns } from 'plaited/eval'

const comparison = compareEvalRuns({
  baseline: { label: 'run-a', tasks: [{ taskId: 'task-1', trials: [...] }] },
  challenger: { label: 'run-b', tasks: [{ taskId: 'task-1', trials: [...] }] },
  k: 10, // optional k-sample estimation
})
```

Returns per-task comparison rows with baseline/challenger metrics, pass rates, average scores, and optional `estimatedPassAtK`/`estimatedPassAllK`.

### `calibrateEvalRun`

```ts
import { calibrateEvalRun } from 'plaited/eval'

const calibrated = calibrateEvalRun({
  bundle: { label: 'run-1', tasks: [...] },
  focus: 'required_failures', // 'required_failures' | 'all_failures' | 'all'
  sample: 20,
  seed: 'my-seed',
  graderId: 'judge-json', // optional focus on specific grader
  snapshotMode: 'diagnostic', // 'diagnostic' | 'all'
  maxSnapshotsPerSample: 8,
  isDiagnosticEvent: (event) => { /* tag diagnostic events */ },
})
```

Does not run graders — it samples already-graded `EvalTrialResult` rows. The `isDiagnosticEvent` predicate controls which events are diagnostic for targeted extraction. Default `() => false` falls back to head/tail/midpoint selection.

### `readGraderStdin` / `writeGraderStdout`

```ts
import { readGraderStdin, writeGraderStdout } from 'plaited/eval'

const payload = await readGraderStdin()
// ... evaluate ...
writeGraderStdout({ pass: true, score: 0.9, reasoning: 'good' })
```

Helpers for command graders to parse stdin and write results without boilerplate.

## Behavioral Bridge

Use the bridge when grading behavioral-program (BP) trials with `SnapshotMessage` events.

### `processGrader`

```ts
import { processGrader } from 'plaited/eval'

const result = await processGrader({
  trial: behavioralTrial, // EvalTrial<SnapshotMessage>
  options: {
    failOnRuntimeError: true,
    failOnFeedbackError: true,
    failOnDeadlock: true,
    maxSelections: 50,
    maxRepeatedSelectionType: 10,
  },
  previousResults: [],
})
```

Returns a grader result with pass/fail and process summary in `outcome.process`.

### `summarizeEvalTrialProcess`

```ts
import { summarizeEvalTrialProcess } from 'plaited/eval'

const summary = summarizeEvalTrialProcess(trial.events)
// { snapshotCount, selectionCount, runtimeErrorCount, ... }
```

### `isSnapshotDiagnostic`

```ts
import { isSnapshotDiagnostic } from 'plaited/eval'

calibrateEvalRun({
  bundle,
  isDiagnosticEvent: isSnapshotDiagnostic,
})
```

Use this as the `isDiagnosticEvent` predicate when calibrating behavioral trials.

## Reference Docs

- [Trial Shape](references/trial-shape.md) — `EvalTrial<TEvents>` contract
- [Graders](references/graders.md) — grader stdin/stdout contract and decision guide
- [Pi Integration](references/pi-integration.md) — pi extension patterns (consumer adapts)
- [Scaffold](references/scaffold.md) — scaffold-skill guidance

## See Also

- `frontier-analysis` skill — for behavioral frontier replay/exploration/verification
