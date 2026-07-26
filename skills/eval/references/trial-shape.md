# Trial Shape — `EvalTrial<TEvents>`

```ts
type EvalTrial<TEvents = unknown> = {
  id: string                    // Unique trial identifier
  cwd: string                   // Working directory for command graders
  task: {
    id: string                  // Task identifier
    prompt: string              // Prompt executed for the trial
    metadata?: Record<string, unknown>  // Optional task metadata
  }
  result: {
    status: 'completed' | 'failed' | 'timed_out' | 'cancelled'
    message?: string            // Required when status is 'completed'
    error?: string              // Optional runtime error text
    metadata?: Record<string, unknown>  // Optional trial-result metadata
  }
  events: TEvents[]             // Full retained event stream
  metadata?: Record<string, unknown>  // Unconstrained operational bucket
}
```

## Fields

### `events: TEvents[]`

The full retained event/snapshot stream for the trial. The core eval engine never inspects events — it passes them through to graders. This allows:

- **Behavioral trials**: events are `SnapshotMessage[]` — snapshots of the BP engine (selections, errors, deadlocks)
- **Other SDKs**: events are whatever the SDK produces — request/response pairs, function calls, tool invocations
- **Custom harnesses**: events can be any typed array — log lines, state diffs, assertions

Graders that need to examine events (like `processGrader`) consume the specific event type.

### `metadata: Record<string, unknown>`

The unconstrained operational bucket. Use it for:

- Model identifier (`model: 'gpt-4'`)
- Run identifier (`runId: 'abc-123'`)
- Latency or spend data (`durationMs: 1500`, `costUsd: 0.05`)
- Token usage (`promptTokens: 500`, `completionTokens: 200`)
- Any other operational metadata the harness collects

There is no top-level `invocation` field — invoke details go in `metadata`.

### `result`

The terminal trial result. Key rules:

- `completed` requires `message` (validated by `buildEvalTrial`)
- Non-completed statuses force `pass=false` and `score=0` at grade time
- `error` is optional — for runtime errors emitted alongside any status
- `metadata` carries harness-level result metadata (e.g., finish reason)

### `task`

Identifies which task/job this trial belongs to. The `prompt` field holds the task prompt text. `metadata` carries harness-level task metadata (e.g., difficulty, category).
