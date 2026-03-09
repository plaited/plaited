---
name: compare-trials
description: Compare trial results from the trial runner. Teaches agents to write comparison and analysis scripts against TrialResult JSONL files for pass@k reliability analysis, bootstrap confidence intervals, and flakiness detection.
license: ISC
---

# Compare Trials

## Purpose

This skill teaches agents how to analyze and compare `TrialResult` JSONL output from the `trial` runner. Instead of a built-in comparison command, agents write scripts directly — the analysis is domain-specific and benefits from code-level flexibility.

**Use this when:**
- Comparing trial results from multiple adapter runs
- Computing statistical metrics (bootstrap confidence intervals, effect sizes)
- Analyzing flakiness (pass@k vs pass^k gap)
- Generating comparison reports

## TrialResult Schema

Each line in a trial JSONL file matches this shape:

```typescript
type TrialResult = {
  id: string                           // Prompt identifier
  input: string | string[]             // Original prompt
  hint?: string                        // Grader context
  k: number                            // Trials per prompt
  passRate?: number                    // passes / k
  passAtK?: number                     // 1 - (1 - passRate)^k
  passExpK?: number                    // passRate^k
  trials: TrialEntry[]                 // Individual trial data
  metadata?: Record<string, unknown>   // Custom metadata
}

type TrialEntry = {
  trialNum: number
  output: string
  trajectory?: TrajectoryStep[]
  duration: number                     // Wall-clock ms
  timing?: { total?: number; inputTokens?: number; outputTokens?: number }
  exitCode?: number | null
  timedOut?: boolean
  pass?: boolean
  score?: number
  reasoning?: string
  outcome?: Record<string, unknown>
}
```

## Key Metrics

| Metric | Formula | Meaning |
|--------|---------|---------|
| `passRate` | passes / k | Raw success rate |
| `passAtK` | 1 - (1 - passRate)^k | Capability — can it solve this at all? |
| `passExpK` | passRate^k | Reliability — does it solve this every time? |
| `flakiness` | passAtK - passExpK | Gap between capability and reliability |

## How to Compare

1. Load two (or more) JSONL files
2. Index results by prompt `id`
3. Compute aggregate metrics per run
4. Bootstrap for confidence intervals
5. Output comparison as structured JSON

## Reference Implementation

**[compare.ts](references/compare.ts)** — Complete comparison script

Takes two JSONL file paths, loads and indexes them, computes per-run and per-prompt metrics, runs bootstrap resampling for confidence intervals, and outputs a structured comparison report.

**[bootstrap.ts](references/bootstrap.ts)** — Bootstrap sampling utility

Reusable bootstrap function for computing confidence intervals on any metric. Used by the comparison script for reliable statistical comparisons.

## Usage Pattern

```bash
# Agent writes and runs a comparison script
bun run compare.ts baseline.jsonl challenger.jsonl > report.json

# Or inline in the trial runner
const results = await runTrial({ adapter, prompts, k: 10, grader })
// Agent analyzes results array directly — no file round-trip needed
```

## Key Points for Agents

- `TrialResult` files are JSONL (one JSON object per line)
- Always match results by `id` — prompts may arrive in different order
- Bootstrap needs at least 30 samples for reliable CIs (use 1000+ resamples)
- Flakiness = passAtK - passExpK measures inconsistency
- Token usage is optional — only present if the adapter reports it
- Comparison is agent-written code, not a built-in command
