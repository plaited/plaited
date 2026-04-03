---
name: trial-runner
description: Run repeated trials against `src/improve` adapters, capture trajectories, and optionally grade and meta-verify results. Library-first API with CLI secondary.
license: ISC
---

# Trial Runner

## Purpose

Run prompts against an adapter, capture structured results, and optionally grade
them. The fundamental operation is a **trial**: running k attempts per prompt
and measuring pass@k reliability.

This is one evaluation mode inside `src/improve`, not the whole improvement
workflow.

**The runner executes repeated trials. You provide adapters and graders, and may
optionally add verifier/meta-verification policy on top.**

| Runner Provides | You Provide |
|-----------------|-------------|
| Trial execution (k runs per prompt) | Adapter script (wraps your agent CLI) |
| Structured JSONL output | Grader script (scores output) |
| pass@k/pass^k metrics | Prompts (JSONL) |
| Concurrent execution + workspace isolation | Comparison analysis scripts |
| Optional verifier wrapping via `src/improve` | Policy for when meta-verification matters |

**Use this when:**
- Evaluating agent quality with pass@k reliability metrics
- Capturing trajectories for downstream scoring or training
- Comparing agents across configurations (via `compare-trials` skill)
- Running repeated prompt suites against Pi, Plaited-native, or external adapters

Use a repo-specific worktree automation surface instead when the question is:
- mutate workspace state
- validate candidate attempts
- judge workspace improvements
- select a promotable attempt

## Library API (Primary)

The in-process API is the primary interface. Agents call `runTrial()` directly:

```typescript
import { runTrial } from './src/improve.ts'
import type { Adapter, Grader } from './src/improve.ts'

const adapter: Adapter = async ({ prompt, cwd }) => {
  const proc = Bun.spawn(['my-agent', '--prompt', prompt], { cwd })
  const output = await new Response(proc.stdout).text()
  return { output }
}

const results = await runTrial({
  adapter,
  prompts: [{ id: 'p1', input: 'Create a button component' }],
  grader: async ({ output, cwd }) => {
    const tests = await Bun.$`cd ${cwd} && bun test`.nothrow()
    return { pass: tests.exitCode === 0, score: tests.exitCode === 0 ? 1 : 0 }
  },
  k: 10,
  concurrency: 4,
  workspaceDir: './workspaces',
})
// results[0].passRate, results[0].passAtK, results[0].passExpK
```

If you want meta-verification, wrap the grader using `withMetaVerification(...)`
from `src/improve` before calling `runTrial()`.

### runTrial Config

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `adapter` | `Adapter` | required | Function or loaded from path |
| `prompts` | `PromptCase[]` | required | Prompt cases to run |
| `grader` | `Grader` | none | Optional grading function |
| `k` | `number` | 1 | Trials per prompt |
| `outputPath` | `string` | none | JSONL output file (stdout if absent) |
| `cwd` | `string` | none | Working directory for adapter |
| `timeout` | `number` | 60000 | Timeout per prompt in ms |
| `concurrency` | `number` | 1 | Concurrent workers |
| `workspaceDir` | `string` | none | Per-prompt workspace isolation base dir |
| `progress` | `boolean` | false | Show progress to stderr |
| `append` | `boolean` | false | Append to output file |

Verifier loading and meta-verification are separate `src/improve` utilities. The
trial runner intentionally stays focused on repeated execution and result capture.

## CLI (Secondary)

The CLI resolves file paths to functions, then delegates to `runTrial`:

```bash
# Basic trial
plaited eval '{"adapterPath":"./adapter.ts","promptsPath":"prompts.jsonl","k":5}'

# With grader and progress
plaited eval '{"adapterPath":"./adapter.ts","promptsPath":"prompts.jsonl","k":10,"graderPath":"./grader.ts","concurrency":4,"progress":true}'

# Schema discovery
plaited eval --schema input
plaited eval --schema output
plaited eval --help
```

## Input Format (prompts.jsonl)

```jsonl
{"id":"test-001","input":"Create a button","hint":"should contain <button>"}
{"id":"test-002","input":["Create a button","Make it blue"],"metadata":{"category":"ui"}}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier |
| `input` | Yes | Single prompt (string) or multi-turn (string[]) |
| `hint` | No | Grader context |
| `reference` | No | Reference solution |
| `metadata` | No | Tags, category, difficulty |
| `timeout` | No | Per-case timeout override (ms) |

## Output Format (TrialResult JSONL)

Each line is a `TrialResult`:

```jsonl
{"id":"test-001","input":"Create a button","k":5,"passRate":0.8,"passAtK":0.99,"passExpK":0.33,"trials":[{"trialNum":1,"output":"...","duration":1234,"pass":true,"score":1.0},...],"metadata":{"category":"ui"}}
```

### TrialEntry Fields

| Field | Always | Description |
|-------|--------|-------------|
| `trialNum` | Yes | Trial number (1-indexed) |
| `output` | Yes | Agent response text |
| `duration` | Yes | Wall-clock ms |
| `trajectory` | No | Structured trajectory (adapter-dependent) |
| `timing` | No | Adapter-reported timing + token counts |
| `pass` | No | Pass/fail (with grader) |
| `score` | No | Numeric score 0-1 (with grader) |
| `reasoning` | No | Grader explanation |

## Key Metrics

| Metric | Formula | Meaning |
|--------|---------|---------|
| `passRate` | passes / k | Raw success rate |
| `passAtK` | 1 - (1 - passRate)^k | Capability — can it solve this at all? |
| `passExpK` | passRate^k | Reliability — does it solve this every time? |

## Grader Contract

Graders follow the polyglot pattern — TS module (`export const grade`) or executable (stdin/stdout JSON).

### Git-Based Grading (Coding Tasks)

```typescript
import type { Grader } from './src/improve.ts'

export const grade: Grader = async ({ output, hint, cwd }) => {
  if (!cwd) return { pass: false, score: 0, reasoning: 'No cwd' }
  const tests = await Bun.$`cd ${cwd} && bun test`.nothrow()
  return {
    pass: tests.exitCode === 0,
    score: tests.exitCode === 0 ? 1 : 0,
    reasoning: `Tests: ${tests.exitCode === 0 ? 'pass' : 'fail'}`,
  }
}
```

### Executable Graders

Any executable — reads JSON from stdin, writes `GraderResult` to stdout:

```python
#!/usr/bin/env python3
import json, sys
data = json.load(sys.stdin)
output = data.get("output", "").lower()
hint = (data.get("hint") or "").lower()
passed = hint in output if hint else True
print(json.dumps({"pass": passed, "score": 1.0 if passed else 0.0}))
```

## Verifier and Meta-Verification

`runTrial()` itself does not require a verifier, but `src/improve` supports them.
Use a verifier when:

- grader trust is uncertain
- prompts are adversarial
- promotion or training inclusion depends on stable grading

Meta-verification is especially useful when trial outputs feed downstream
training or retention logic, but it should remain optional by policy rather than
always-on.

## Schema Exports

```typescript
import {
  AdapterResultSchema,
  GraderResultSchema,
  PromptCaseSchema,
  EvalInputSchema,
  EvalOutputSchema,
  TrialResultSchema,
} from './src/improve.ts'
import * as z from 'zod'

// Generate JSON Schema (Zod 4 native)
const jsonSchema = z.toJSONSchema(TrialResultSchema)
```

## Related

- **[trial-adapters](../trial-adapters/SKILL.md)** — Writing adapter scripts for the trial runner
- **[compare-trials](../compare-trials/SKILL.md)** — Statistical comparison of trial results
