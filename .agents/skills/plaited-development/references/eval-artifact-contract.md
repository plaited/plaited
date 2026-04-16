# External Evaluation Artifact Contract

Agent-facing evaluation tooling in Plaited produces and consumes structured trial
result artifacts. This document describes the minimal contract required for a demo
repository to integrate with `plaited eval` and `plaited compare-trials`.

## Minimal Artifact Fields

| Field | Type | Description | Schema Mapping |
|-------|------|-------------|---------------|
| `taskId` | `string` | Unique test case identifier | `TrialResult.id` |
| `input` | `string \| string[]` | Original prompt input | `TrialResult.input` |
| `finalAnswer` | `string` | Final agent response text | `TrialResult.trials[0].output` |
| `sources` | `TrajectoryStep[]` | Full agent trajectory (optional) | `TrialResult.trials[].trajectory` |
| `usage.tokensIn` | `number` | Total input tokens consumed | `TrialResult.trials[].timing?.inputTokens` |
| `usage.tokensOut` | `number` | Total output tokens generated | `TrialResult.trials[].timing?.outputTokens` |

> **Note:** `modelCalls`, `retrievalCalls`, and `estimatedCostUsd` can be attached via
> `TrialResult.metadata`. The minimal valid artifact requires `tokensIn` and `tokensOut`.

## Schema Overview

### TrialResultSchema (Primary Output)

```typescript
// src/cli/eval/eval.schemas.ts
export const TrialResultSchema = z.object({
  id: z.string(),                    // taskId
  input: z.union([z.string(), z.array(z.string())]),  // input
  k: z.number(),                     // trials per prompt
  passRate: z.number().optional(),
  passAtK: z.number().optional(),
  passExpK: z.number().optional(),
  trials: z.array(TrialEntrySchema),
  metadata: z.record(z.string(), z.unknown()).optional(),  // for usage/extra
})
```

### TrialEntrySchema (Per-Trial Data)

```typescript
export const TrialEntrySchema = z.object({
  trialNum: z.number(),
  output: z.string(),               // finalAnswer
  trajectory: z.array(TrajectoryStepSchema).optional(),  // sources
  duration: z.number(),
  timing: TimingSchema.optional(),   // contains tokensIn/tokensOut
  // ... grading fields if grader provided
})
```

### TimingSchema (Token Usage)

```typescript
export const TimingSchema = z.object({
  total: z.number().optional(),       // adapter-reported duration in ms
  inputTokens: z.number().optional(), // tokensIn
  outputTokens: z.number().optional(), // tokensOut
})
```

### TrajectoryStepSchema (Agent Steps)

```typescript
export const TrajectoryStepSchema = z.object({
  type: z.string(),                  // e.g., \'message\', \'thought\', \'tool_call\'
  status: z.string().optional(),    // e.g., \'completed\', \'failed\'
  timestamp: z.number().optional(),
}).passthrough()                     // allows additional provider-specific fields
```

## JSONL Line Format

Trial results are emitted as newline-delimited JSON (JSONL) with one `TrialResult` per line.

## Minimal Valid Artifact Example

```json
{
  "id": "demo-task-001",
  "input": "What is 2+2?",
  "k": 1,
  "trials": [
    {
      "trialNum": 1,
      "output": "4",
      "duration": 150,
      "trajectory": [
        { "type": "message", "content": "What is 2+2?", "timestamp": 1000 },
        { "type": "thought", "content": "Simple arithmetic", "timestamp": 1010 },
        { "type": "message", "content": "4", "timestamp": 1020 }
      ],
      "timing": { "total": 150, "inputTokens": 12, "outputTokens": 3 }
    }
  ],
  "metadata": {
    "usage": { "modelCalls": 1, "retrievalCalls": 0, "estimatedCostUsd": 0.0001 }
  }
}
```

## CLI Schema Discovery

Agents discover artifact structure via CLI schema commands:

```bash
# Top-level command manifest
bunx plaited --schema

# Eval input schema (adapter + prompts format)
bunx plaited eval --schema input

# Eval output schema (TrialResult format)
bunx plaited eval --schema output

# Compare-trials input schema
bunx plaited compare-trials --schema input

# Compare-trials output schema
bunx plaited compare-trials --schema output
```

## Adapter Contract

An adapter receives `AdapterInput` and returns `AdapterResult`:

```typescript
// Input to adapter
type AdapterInput = {
  prompt: string | string[]  // single or multi-turn
  cwd?: string               // working directory
  systemPrompt?: string       // optional scenario override
}

// Output from adapter
type AdapterResult = {
  output: string             // finalAnswer
  trajectory?: TrajectoryStep[]
  capture?: CaptureEvidence
  timing?: Timing           // tokens in/out, duration
  exitCode?: number | null
  timedOut?: boolean
}
```

## Grader Contract (Optional)

```typescript
type GraderInput = {
  input: string | string[]
  output: string
  hint?: string
  trajectory?: TrajectoryStep[]
  metadata?: Record<string, unknown>
  cwd?: string
}

type GraderResult = {
  pass: boolean
  score: number              // 0.0 to 1.0
  reasoning?: string
  outcome?: Record<string, unknown>
  dimensions?: {
    outcome?: number        // correctness (0-1)
    process?: number        // reasoning quality (0-1)
    efficiency?: number     // resource usage (0-1)
  }
  metaVerification?: {
    confidence: number
    reasoning?: string
  }
}
```

## File Structure for Demo Repos

```
my-demo/
├── adapter.ts              # Implements Adapter contract
├── grader.ts               # (optional) Implements Grader contract
├── prompts.jsonl           # One PromptCase per line
├── results/
│   ├── run-a.jsonl         # Baseline trial results
│   └── run-b.jsonl         # Challenger trial results
└── package.json            # devDependency on plaited
```

## Running Evaluation

```bash
# Run eval with adapter and prompts
bunx plaited eval '{"adapterPath":"./adapter.ts","promptsPath":"./prompts.jsonl"}' > results/run-a.jsonl

# Run with grading
bunx plaited eval '{"adapterPath":"./adapter.ts","promptsPath":"./prompts.jsonl","graderPath":"./grader.ts"}' > results/run-a.jsonl

# Compare two runs
bunx plaited compare-trials '{"baselinePath":"./results/run-a.jsonl","challengerPath":"./results/run-b.jsonl"}'
```

## Schema References

| Schema | File |
|--------|------|
| `TrialResultSchema` | `src/cli/eval/eval.schemas.ts` |
| `TrialEntrySchema` | `src/cli/eval/eval.schemas.ts` |
| `TimingSchema` | `src/cli/eval/eval.schemas.ts` |
| `TrajectoryStepSchema` | `src/cli/eval/eval.schemas.ts` |
| `EvalInputSchema` | `src/cli/eval/eval.ts` |
| `EvalOutputSchema` | `src/cli/eval/eval.ts` |
| `CompareTrialsInputSchema` | `src/cli/compare-trials/compare-trials.schemas.ts` |
| `CompareTrialsOutputSchema` | `src/cli/compare-trials/compare-trials.schemas.ts` |
