---
name: plaited-eval
description: Research-run comparison and promotion CLI guidance for Plaited. Use when comparing baseline vs challenger runs, validating trial-pass evidence coverage, and selecting promotion decisions.
license: ISC
compatibility: Requires bun
---

# Plaited Eval

CLI guidance for the current eval/research operator surface.

## When To Use

- Compare two run bundles (`baseline` vs `challenger`)
- Enforce canonical trial-pass evidence policy before promotion
- Compute pass-rate/pass@k deltas and promotion decisions
- Discover `research` command schemas for tooling integration

## Command Discovery

```bash
bunx plaited --schema
bunx plaited research --schema input
bunx plaited research --schema output
```

## Active CLI Surface

`plaited research` is the active comparison/promotion command.

```bash
bunx plaited research '{
  "baseline": {
    "label": "baseline",
    "results": [
      {
        "id": "p1",
        "input": "alpha",
        "trials": [{"trialNum":1,"output":"ok","duration":20,"pass":true,"score":1}]
      }
    ]
  },
  "challenger": {
    "label": "challenger",
    "results": [
      {
        "id": "p1",
        "input": "alpha",
        "trials": [{"trialNum":1,"output":"ok","duration":18,"pass":true,"score":1}]
      }
    ]
  },
  "resamples": 1000,
  "confidence": 0.95,
  "minPassRateDelta": 0,
  "minWinDelta": 1
}'
```

## Canonical Comparison Policy

- Canonical evidence is `trials[].pass`
- Full `trials[].pass` coverage is required for comparability
- Partial/zero coverage is `insufficient_data`
- Cached aggregates (`passRate`, `passAtK`, `passExpK`) are derived fields
- Full trial evidence overrides inconsistent cached aggregates

## Metric Semantics

- `passRate = passes / k`
- `passAtK = 1 - (1 - passRate)^k`
- `passExpK = passRate^k`

## Artifact Shape

`research` expects run bundles using `ResearchRun` / `ResearchPromptResult` shapes from:

- `src/research/research.schema.ts`
- `src/research/research.comparison.utils.ts`
- `src/research/research.grading.utils.ts`

Trial process evidence helpers live in:

- `src/eval/eval.schema.ts`
- `src/eval/eval.process.ts`

## Related Skills

- `plaited-eval-adapters`
- `plaited-context`
