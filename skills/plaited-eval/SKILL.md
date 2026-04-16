---
name: plaited-eval
description: Trial runner and strategy comparison CLI for the Plaited framework. Use when running evals against agent adapters, computing pass@k metrics, or comparing two eval runs.
license: ISC
compatibility: Requires bun
---

# Plaited Eval

CLI-first evaluation tooling for running prompt trials against agent adapters and comparing strategy performance.

## When to use

- Running evaluation trials against custom agent adapters
- Computing pass@k and pass^k metrics with grading
- Comparing two eval runs (baseline vs challenger)
- Discovering schema inputs/outputs for the eval pipeline

## Command Discovery

List all available commands:

```bash
bunx plaited --schema
```

Discover input/output schemas for a specific command:

```bash
bunx plaited eval --schema input
bunx plaited eval --schema output
bunx plaited compare-trials --schema input
bunx plaited compare-trials --schema output
```

## plaited eval

Runs prompts against an adapter k times, optionally grades results, and computes pass@k/pass^k metrics.

### Basic usage

```bash
# Run eval with prompts from stdin
echo '{"id":"test-1","input":"Hello"}' | bunx plaited eval '{
  "adapterPath": "./my-adapter.ts",
  "k": 1
}'

# Run eval with prompts from file
bunx plaited eval '{
  "adapterPath": "./my-adapter.ts",
  "promptsPath": "./prompts.jsonl",
  "outputPath": "./results.jsonl",
  "k": 3,
  "concurrency": 2
}'
```

### With grading

```bash
bunx plaited eval '{
  "adapterPath": "./my-adapter.ts",
  "promptsPath": "./prompts.jsonl",
  "graderPath": "./my-grader.ts",
  "k": 5,
  "outputPath": "./results.jsonl"
}'
```

### Input schema fields

| Field | Required | Description |
|-------|----------|-------------|
| `adapterPath` | Yes | Path to adapter script (.ts/.js module or executable) |
| `promptsPath` | No | Path to prompts.jsonl (default: read from stdin) |
| `outputPath` | No | Output file path (default: stdout) |
| `k` | No | Trials per prompt (default: 1) |
| `graderPath` | No | Path to grader script |
| `cwd` | No | Working directory for adapter |
| `timeout` | No | Timeout per prompt in ms (default: 60000) |
| `concurrency` | No | Concurrent workers (default: 1) |
| `workspaceDir` | No | Per-prompt workspace isolation base dir |
| `progress` | No | Show progress to stderr (default: false) |
| `append` | No | Append to output file (default: false) |
| `debug` | No | Enable debug mode (default: false) |

## plaited compare-trials

Compares two TrialResult JSONL runs and computes aggregate metrics plus per-prompt deltas with bootstrap confidence intervals.

### Basic usage

```bash
bunx plaited compare-trials '{
  "baselinePath": "./baseline-results.jsonl",
  "challengerPath": "./challenger-results.jsonl"
}'
```

### With custom labels and confidence settings

```bash
bunx plaited compare-trials '{
  "baselinePath": "./baseline-results.jsonl",
  "challengerPath": "./challenger-results.jsonl",
  "baselineLabel": "gpt-4",
  "challengerLabel": "gpt-4o",
  "confidence": 0.95,
  "resamples": 1000
}'
```

### Input schema fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `baselinePath` | Yes | - | Path to baseline TrialResult JSONL |
| `challengerPath` | Yes | - | Path to challenger TrialResult JSONL |
| `baselineLabel` | No | "baseline" | Label for baseline run |
| `challengerLabel` | No | "challenger" | Label for challenger run |
| `confidence` | No | 0.95 | Confidence level for bootstrap CI |
| `resamples` | No | 1000 | Bootstrap resamples |

### Output structure

The comparison returns:
- **baseline/challenger run metrics**: avgPassRate, avgPassAtK, avgPassExpK, avgFlakiness, avgDuration, medianDuration, confidence intervals
- **per-prompt comparison**: individual prompt results with winner
- **summary**: win counts and totals

## Trial Artifacts

Eval runs produce `TrialResult` objects as JSONL:

```json
{
  "id": "prompt-case-id",
  "input": "The prompt text",
  "k": 3,
  "passRate": 0.67,
  "passAtK": 0.96,
  "passExpK": 0.30,
  "trials": [
    {
      "trialNum": 1,
      "output": "Agent response...",
      "duration": 1234,
      "pass": true,
      "score": 0.9,
      "reasoning": "Correct and complete"
    }
  ],
  "metadata": {}
}
```

### Metrics explained

| Metric | Description |
|--------|-------------|
| `passRate` | Simple ratio: passes / k |
| `pass@k` | Probability of at least one pass in k samples |
| `pass^k` | Probability of all k samples passing |
| `avgFlakiness` | pass@k - pass^k (indicates non-determinism) |

## Strategy Comparison

Use `compare-trials` to evaluate strategy changes:

1. Run baseline evaluation
   ```bash
   bunx plaited eval '{
     "adapterPath": "./adapters/baseline.ts",
     "promptsPath": "./prompts.jsonl",
     "k": 5,
     "outputPath": "./baseline.jsonl"
   }'
   ```

2. Run challenger evaluation
   ```bash
   bunx plaited eval '{
     "adapterPath": "./adapters/challenger.ts",
     "promptsPath": "./prompts.jsonl",
     "k": 5,
     "outputPath": "./challenger.jsonl"
   }'
   ```

3. Compare results
   ```bash
   bunx plaited compare-trials '{
     "baselinePath": "./baseline.jsonl",
     "challengerPath": "./challenger.jsonl",
     "baselineLabel": "strategy-a",
     "challengerLabel": "strategy-b"
   }'
   ```

## Prompts Format

Prompts are provided as JSONL (newline-delimited JSON):

```jsonl
{"id": "case-1", "input": "What is 2+2?"}
{"id": "case-2", "input": "Write a hello world in Python"}
{"id": "case-3", "input": ["First turn", "Follow up question"], "hint": "Multi-turn"}
```

### Prompt case fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique test case identifier |
| `input` | Yes | Prompt text or array of strings for multi-turn |
| `hint` | No | Grader context hint |
| `reference` | No | Reference solution |
| `metadata` | No | Categorization metadata |
| `timeout` | No | Per-case timeout override (ms) |

## Related Skills

- `plaited-eval-adapters` for writing eval-compatible adapter scripts
