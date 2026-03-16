# Autonomous Research Loops

> **Status: DESIGN** — Variant 1 (Skill Calibration) is the active approach. Other variants are documented for future adoption. Inspired by [karpathy/autoresearch](https://github.com/karpathy/autoresearch).

## Core Pattern

The autoresearch loop applies the scientific method autonomously:

```
LOOP FOREVER:
  1. Hypothesize (agent reads results, forms idea)
  2. Modify (agent edits the variable — skill content, framework code, etc.)
  3. Experiment (run eval with fixed time budget)
  4. Measure (grade against objective metric)
  5. Keep or discard (git commit or git revert)
  6. Log (append result to cumulative log)
```

Three conditions for effectiveness:
1. **Fast feedback loop** — experiments complete in minutes, not hours
2. **Clear metric** — objective, measurable, comparable across runs
3. **Programmatic access** — agent can modify inputs and run experiments via tools

## Variant 1: Skill Calibration Loop (Active)

**Variable:** Skill content files (`.md` references, prompt JSONL)
**Metric:** Composite grader score (avg across weakest prompts)
**Time budget:** ~10 min per prompt evaluation

The agent identifies the weakest prompts from eval results, hypothesizes why they fail (bad wording, missing skill pattern, grader miscalibration), modifies skill content, and re-evaluates. See `scripts/auto-calibrate.ts` for the orchestrator.

## Variant 2: Framework Quality Loop

**Variable:** Framework source code (`src/agent/`, `src/tools/`)
**Metric:** `tsc --noEmit` + `bun test src/ skills/` pass rate, then pilot eval scores
**Time budget:** Seconds (quality gate) + ~10 min (pilot eval)

Two-speed loop: fast inner loop (type check + tests, seconds) and slow outer loop (eval on 5 pilot prompts). The agent modifies framework code, validates quickly, then confirms with eval.

Useful for improving tool handlers, context assembly, gate predicates — anything where code changes should improve generation quality measurably.

## Variant 3: Proactive Infrastructure Loop

**Variable:** Proactive framework code (heartbeat, sensors, goals, push routing)
**Metric:** Proactive-specific tests + integration eval
**Time budget:** Seconds (tests) + ~10 min (integration check)

Automates the Phase 5 prompt chain as a single session. The agent follows the dependency chain (wire proactive → sensor contract → set_heartbeat → push routing), implementing and testing each piece, without waiting for a human to invoke each prompt.

## Variant 4: Multi-Agent Tournament

**Variable:** Which frontier agent produces the best trajectories
**Metric:** Composite grader scores per agent per prompt
**Time budget:** ~10 min per prompt × 3 agents

Runs the same prompt through Claude Code, Gemini, and Codex. Compares scores, identifies which agent excels at which domain, and auto-selects the best trajectory per prompt for SFT data. Useful during distillation (Phase 6).

## Variant 5: Overnight Autonomous Session

**Variable:** Everything (framework code, skill content, eval prompts)
**Metric:** Quality gate + eval composite scores
**Time budget:** 8+ hours unattended

Combines Variants 1+3 into a phased overnight program. The agent implements proactive primitives, writes skill content, runs calibration loops, and collects trajectories — all autonomously. Uses a `program.md` that encodes the phase structure and never-stop rule.

## Infrastructure

| Component | Status | Location |
|---|---|---|
| Trial runner | Exists | `src/tools/trial.ts` |
| Module grader | Exists | `src/tools/module-grader.ts` |
| Adapters | Exist | `src/tools/adapters/` |
| Result persistence | Exists | `src/tools/trial.utils.ts` |
| Compare-trials | Exists | `skills/compare-trials/` |
| Git keep/discard | Exists | `scripts/git-experiment.ts` |
| Stop hook (never-stop) | Exists | `.claude/hooks/Stop` |
| Cumulative results log | Exists | `.memory/evals/experiments.jsonl` |

## Stop Hook — Autonomous Loop Enforcement

The `.claude/hooks/Stop` hook blocks Claude from stopping during research sessions. It's **opt-in via environment variables** — normal sessions are unaffected.

### Usage

```bash
# Start an autonomous calibration session
PLAITED_AUTO_RESEARCH=1 claude

# With a custom experiment limit (default: 20)
PLAITED_AUTO_RESEARCH=1 PLAITED_MAX_EXPERIMENTS=50 claude

# Then prompt:
# "Read docs/AUTO-RESEARCH.md. Run Variant 1: Skill Calibration Loop.
#  Start by loading the latest eval results from .memory/evals/"
```

The hook reads `.memory/evals/experiments.jsonl` to count completed experiments. When the count reaches `PLAITED_MAX_EXPERIMENTS`, Claude is allowed to stop. Until then, the `Stop` event is blocked with a reason message.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PLAITED_AUTO_RESEARCH` | unset | Set to `1` to enable the loop |
| `PLAITED_MAX_EXPERIMENTS` | `20` | Number of experiments before auto-stop |

## Git Experiment Helpers

`scripts/git-experiment.ts` provides the keep/discard pattern:

```typescript
import {
  commitExperiment,
  discardExperiment,
  logExperiment,
  loadExperiments,
  getBaseline,
} from '../scripts/git-experiment.ts'

// After modifying skill content:
const sha = await commitExperiment('tighten MSS boundary guidance')

// After running eval and comparing:
if (improved) {
  await logExperiment({
    commit: sha,
    scores: { intention: 0.95, static: 1.0, dynamic: 0.88, composite: 0.94 },
    status: 'keep',
    description: 'tighten MSS boundary guidance',
    timestamp: new Date().toISOString(),
    prompts: ['interactive-map', 'physics-simulator'],
  })
} else {
  await discardExperiment()
  await logExperiment({
    commit: sha,
    scores: { intention: 0.90, static: 1.0, dynamic: 0.75, composite: 0.88 },
    status: 'discard',
    description: 'tighten MSS boundary guidance',
    timestamp: new Date().toISOString(),
    prompts: ['interactive-map', 'physics-simulator'],
  })
}

// Load cumulative history
const baseline = await getBaseline()
const allExperiments = await loadExperiments()
```

## Key Difference from Autoresearch

Autoresearch optimizes one file against one scalar metric. This system optimizes **skill content** (multiple files) against **multi-dimensional grading** (Intention × Static × Dynamic). The loop pattern is identical; the measurement surface is richer. This means:

- Keep/discard decisions need composite score comparison, not just `<` on a scalar
- The agent must identify *which dimension* regressed and *which skill file* caused it
- Bootstrap CIs from compare-trials provide statistical confidence on improvements
