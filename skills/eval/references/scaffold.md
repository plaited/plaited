# Scaffold — Building a Custom Eval Harness

This scaffold walks through building an eval harness for a new task. Use it when you need to add grading to a new experiment or agent skill.

## Process

1. **Grill me** — stress-test the plan before writing code
2. **TDD** — write a test for the grader logic, implement to pass
3. **Skeleton** — create the imperative runner script and task files
4. **Calibrate** — sample results for grader review

## Directory Layout

```
scripts/
  run-eval.ts        # imperative runner
tasks/
  task-1.jsonl       # one JSON object per line, each describing a task trial
graders/
  check-output.mjs   # optional command grader
  judge.ts           # optional function grader export
```

## Runner Skeleton (`scripts/run-eval.ts`)

```ts
#!/usr/bin/env bun
import { buildEvalTrial, gradeEvalTrial, compareEvalRuns } from 'plaited/eval'
import { readTasks } from './read-tasks.ts'

const [taskFile, runLabel] = process.argv.slice(2)

const tasks = await readTasks(taskFile)
const trialResults = []

for (const task of tasks) {
  const events = await runTask(task)         // your task executor
  const message = await getAssistantResponse() // collect final output

  const trial = buildEvalTrial({
    id: crypto.randomUUID(),
    cwd: process.cwd(),
    task: { id: task.id, prompt: task.prompt },
    result: { status: 'completed', message },
    events,
    metadata: { model: task.model },
  })

  const result = await gradeEvalTrial({
    trial,
    graders: [
      // add your graders here
      { id: 'process', type: 'json', result: { pass: true, score: 1 } },
    ],
  })

  trialResults.push(result)
  console.log(JSON.stringify(result)) // or persist to file
}
```

## Task File Format (`tasks/task-1.jsonl`)

```json
{"id": "task-1", "prompt": "Solve this math problem: 2 + 2", "expected": "4", "model": "gpt-4"}
{"id": "task-2", "prompt": "Write a poem about Rust", "expected": "contains 'borrow checker'", "model": "claude-3"}
```

## Grader Stubs

### Command Grader (`graders/check-output.mjs`)

```mjs
import { readGraderStdin, writeGraderStdout } from 'plaited/eval'

const payload = await readGraderStdin()
if (!payload) {
  writeGraderStdout({ pass: false, score: 0, reasoning: 'No input' })
}

const { trial } = payload
const message = trial.result.message
const pass = message.length > 0 && message.length < 10000

writeGraderStdout({
  pass,
  score: pass ? 1 : 0,
  reasoning: pass ? 'Output length OK' : 'Output too short or too long',
})
```

### Function Grader (`graders/judge.ts`)

```ts
import type { EvalTrial, EvalGraderResult, EvalInlineGraderResult } from 'plaited/eval'

export const judgeGrader = (ctx: {
  trial: EvalTrial<unknown>
  previousResults: EvalGraderResult[]
}): EvalInlineGraderResult => {
  const events = ctx.trial.events
  // Your domain logic here
  return { pass: true, score: 0.9, reasoning: 'Looks good' }
}
```

## After Running

- Collect `EvalTrialResult` rows into run bundles
- Use `compareEvalRuns` to compare baseline vs challenger
- Use `calibrateEvalRun` to sample for grader review
- Persist results to JSON files for audit trail

### Pi Extension (Optional)

For a pi extension that captures trajectories automatically, see `pi-integration.md` for patterns you adapt to your SDK.
