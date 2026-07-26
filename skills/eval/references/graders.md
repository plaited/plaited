# Graders

## Decision Guide

| Situation | Use |
|-----------|-----|
| Deterministic check on trial events | `function` grader |
| External tool or model invocation | `command` grader |
| Precomputed result from upstream harness | `json` grader |

## Stdin/stdout JSON Contract (command graders)

Command graders receive a JSON payload on stdin and must produce output on stdout.

### Stdin Payload

```json
{
  "trial": { "id": "t-1", "task": { "...": "..." }, "events": [...], "result": {...}, "cwd": "/tmp/run" },
  "grader": { "id": "check", "type": "command", "options": { "command": ["node", "check.mjs"] } },
  "previousResults": [
    { "id": "process", "pass": true, "score": 1, "...": "..." }
  ]
}
```

### Stdout Output (grader_json mode)

```json
{
  "pass": true,
  "score": 0.9,
  "reasoning": "output matches expected format",
  "outcome": { "details": "..." },
  "metadata": { "custom": "value" }
}
```

### Output Modes

- `exit_code` (default): pass iff exit code 0
- `grader_json`: stdout must be valid `EvalInlineGraderResult` JSON — `{ pass, score, reasoning?, outcome?, metadata? }`

If the command exits non-zero in `grader_json` mode, or stdout is invalid JSON/fails schema validation, the grader returns a failed result with captured command output. The overall grade still succeeds — only this one grader fails.

### `readGraderStdin` / `writeGraderStdout`

```ts
import { readGraderStdin, writeGraderStdout } from 'plaited/eval'

const payload = await readGraderStdin<MyEventType>()
if (!payload) {
  writeGraderStdout({ pass: false, score: 0, reasoning: 'No input received' })
}

const events = payload.trial.events // typed as MyEventType[]
// ... evaluate ...

writeGraderStdout({ pass: true, score: 0.95, reasoning: 'All checks passed' })
```

## `function` Grader

```ts
{
  id: 'custom-judge',
  type: 'function',
  required: true,
  weight: 1,
  run: (ctx) => {
    const { trial, previousResults } = ctx
    // Access trial.events (typed as TEvents)
    // Access previousResults from earlier graders
    return {
      pass: true,
      score: 0.8,
      reasoning: 'Good enough',
      outcome: { /* optional structured data */ },
    }
  },
}
```

The return value is validated against `EvalInlineGraderResultSchema` at runtime. Invalid returns produce a failed grader result with schema issues in the reasoning.

## `json` Grader

```ts
{
  id: 'precomputed',
  type: 'json',
  result: { pass: true, score: 0.9, reasoning: 'External judge result' },
}
```

No execution. Used when an upstream harness already produced a judge result.
