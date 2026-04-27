---
name: plaited-eval-adapters
description: Guide for producing research-compatible trial artifacts from external runners. Use when integrating model or agent executions into the `plaited research` comparison flow.
license: ISC
compatibility: Requires bun
---

# Plaited Eval Adapters

Guide for producing `ResearchRun` artifacts from external execution pipelines.

## When To Use

- Integrating external agent/model runners into Plaited comparison flow
- Emitting per-trial pass evidence used by `plaited research`
- Capturing optional process diagnostics with `src/eval` schemas

## Output Contract

Your runner should produce prompt results shaped like `ResearchPromptResult` rows:

```typescript
{
  id: string
  input: string | string[]
  trials: Array<{
    trialNum: number
    output: string
    duration: number
    pass?: boolean
    score?: number
    reasoning?: string
    trace?: PlaitedTrace
    process?: TrialProcessSummary
    metadata?: Record<string, unknown>
  }>
  k?: number
  passRate?: number
  passAtK?: number
  passExpK?: number
  metadata?: Record<string, unknown>
}
```

Bundle rows into runs:

```typescript
{
  label: 'baseline' | 'challenger' | string
  results: ResearchPromptResult[]
}
```

## Important Policy Rules

- `trials[].pass` is canonical comparison evidence
- Full pass coverage is required for comparability
- Partial/zero pass coverage yields `insufficient_data`
- Cached aggregates are optional and treated as derived fields

## Optional Process Evidence

If your runner captures runtime traces, use:

- `src/eval/eval.schema.ts` (`PlaitedTraceSchema`, `TrialProcessSummarySchema`)
- `src/eval/eval.process.ts` (`summarizeTrialProcess` and diagnostics helpers)

This keeps trial evidence and comparison/promotion logic separated.

## Integration Flow

1. Run baseline/challenger executions in your adapter pipeline.
2. Emit `ResearchRun` JSON using canonical `trials[].pass` evidence.
3. Compare and select with:

```bash
bunx plaited research '{"baseline": {...}, "challenger": {...}}'
```

## Related Skills

- `plaited-eval`
- `plaited-context`
