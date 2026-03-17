# Autonomous Research Loops

> **Status: Phase 1 COMPLETE** — Variant 1 achieved 100% MSS classification accuracy (commit b382c74). Now serving Phase 2 (skeleton generation). Other variants activate as PLAN.md phases progress. Inspired by [karpathy/autoresearch](https://github.com/karpathy/autoresearch). See `PLAN.md` for the full phase schedule and model assignments.

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

## Optimization Targets

The loop pattern is general purpose — it works anywhere you have a variable, a metric, and fast feedback. The infrastructure (`Stop` hook, `git-experiment.ts`, experiments JSONL) is target-agnostic.

| Target | Variable | Metric | Feedback |
|---|---|---|---|
| Skill content | `skills/*/references/*.md`, `prompts.jsonl` | Module grader composite score | ~10 min/prompt |
| Framework code | `src/agent/`, `src/tools/` | `tsc` + `bun test` + pilot eval | Seconds + ~10 min |
| bThread generation | `.memory/constitution/*.ts`, `.memory/goals/*.ts` (created at runtime) | tsc + spec tests + trial runner | Seconds |
| Constitution rules | Governance factories, gate predicates | Gate rejection rate, false positive/negative | ~10 min |
| Context assembly | Contributor weights, priorities, trimming | Eval scores (better context → better generation?) | ~10 min/prompt |
| Proactive tuning | Heartbeat interval, sensor configs, goal thresholds | Sensor hit rate, false alarm rate | Minutes |
| System prompts | Base prompt text, tool descriptions | Eval scores across all prompts | ~10 min/prompt |
| Grader accuracy | Block patterns, thresholds, dimension weights | Grader-vs-human agreement, false pass/fail | Seconds (re-grade) |
| Training data | SFT mix, GRPO preference pairs | Student model eval post-training | Hours |
| Node composition | `skills/modnet-node/SKILL.md`, wave patterns | Node-grader 5 dimensions (structure, proactive, constitution, secrets, integration) | ~15 min |
| Messaging modules | MSS patterns for social/stream modules | Outbound risk tags enforced, boundary:ask works, Gate → Simulate → Evaluate | ~10 min |
| Client sensors | `src/server/` sensor_input handling | sensor_input → sensor_delta → goal fires | Seconds (tests) |

To optimize a different target, change the kickoff prompt:

```
Read docs/AUTO-RESEARCH.md. Optimize [TARGET].
Variable: [what to modify].
Metric: [how to measure].
Run the calibration loop.
```

The `Stop` hook doesn't care what you're optimizing. The `git-experiment.ts` keep/discard works on any file.

## Variant 1: Skill Calibration Loop (Active)

**Variable:** Skill content files (`.md` references, prompt JSONL)
**Metric:** Composite grader score (avg across weakest prompts)
**Time budget:** ~10 min per prompt evaluation

The agent identifies the weakest prompts from eval results, hypothesizes why they fail (bad wording, missing skill pattern, grader miscalibration), modifies skill content, and re-evaluates.

**PLAN.md phases served:** Phase 1 (MSS comprehension), Phase 2 (skeleton), Phase 3 (composition), and all skill calibration schedule entries.

## Variant 2: Framework Quality Loop

**Variable:** Framework source code (`src/agent/`, `src/tools/`)
**Metric:** `tsc --noEmit` + `bun test src/ skills/` pass rate, then pilot eval scores
**Time budget:** Seconds (quality gate) + ~10 min (pilot eval)

Two-speed loop: fast inner loop (type check + tests, seconds) and slow outer loop (eval on 5 pilot prompts). The agent modifies framework code, validates quickly, then confirms with eval.

Useful for improving tool handlers, context assembly, gate predicates — anything where code changes should improve generation quality measurably.

**PLAN.md phases served:** Phase 3.5 (multimodal tools), Phase 4 (layered boot).

## Variant 3: Proactive Infrastructure Loop

**Variable:** Proactive framework code (heartbeat, sensors, goals, push routing)
**Metric:** Proactive-specific tests + integration eval
**Time budget:** Seconds (tests) + ~10 min (integration check)

Automates the proactive infrastructure as a single session. The agent follows the dependency chain (wire proactive → sensor contract → set_heartbeat → push routing), implementing and testing each piece, without waiting for a human to invoke each prompt.

**PLAN.md phases served:** Phase 6 (full proactive cycle).

## Variant 4: Multi-Agent Tournament

**Variable:** Which frontier agent produces the best trajectories
**Metric:** Composite grader scores per agent per prompt
**Time budget:** ~10 min per prompt × 3 agents

Runs the same prompt through Claude Code (Anthropic Agent SDK) and Gemini CLI (Google AI SDK). Compares scores, identifies which agent excels at which domain, and auto-selects the best trajectory per prompt for SFT data.

**PLAN.md phases served:** Training checkpoints (trajectory collection for SFT/GRPO).

## Variant 5: Overnight Autonomous Session

**Variable:** Everything (framework code, skill content, eval prompts)
**Metric:** Quality gate + eval composite scores
**Time budget:** 8+ hours unattended

Combines Variants 1+3 into a phased overnight program. The agent implements proactive primitives, writes skill content, runs calibration loops, and collects trajectories — all autonomously. Uses a `program.md` that encodes the phase structure and never-stop rule.

**PLAN.md phases served:** Any phase — overnight sessions can target whichever phase is active.

## Infrastructure

| Component | Status | Location |
|---|---|---|
| Trial runner | Exists | `src/tools/trial.ts` |
| LLM-as-judge | Removed | Was `src/tools/judge.ts` — deleted (vendor lock-in). Phase 4 uses Gemini CLI via `Bun.$` |
| MSS grader (deterministic) | Exists | `src/tools/mss-grader.ts` |
| Training scoring | Exists | `src/tools/training.ts` (meta-verification) |
| Adapters (teachers + student) | Exist | `scripts/claude-code-adapter.ts`, `scripts/falcon-h1r-mlx-adapter.ts`, `src/tools/distillation-adapter.ts` |
| Result persistence | Exists | `src/tools/trial.utils.ts` |
| Compare-trials | Exists | `skills/compare-trials/` |
| Git keep/discard | Exists | `src/tools/git-experiment.ts` |
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

`src/tools/git-experiment.ts` provides the keep/discard pattern:

```typescript
import {
  commitExperiment,
  discardExperiment,
  logExperiment,
  loadExperiments,
  getBaseline,
} from './src/tools/git-experiment.ts'

// After modifying skill content:
const sha = await commitExperiment('tighten MSS boundary guidance')

// After running eval and comparing:
if (improved) {
  await logExperiment({
    commit: sha,
    scores: { outcome: 0.95, process: 1.0, efficiency: 0.88 },
    status: 'keep',
    description: 'tighten MSS boundary guidance',
    timestamp: new Date().toISOString(),
    prompts: ['interactive-map', 'physics-simulator'],
  })
} else {
  await discardExperiment()
  await logExperiment({
    commit: sha,
    scores: { outcome: 0.90, process: 1.0, efficiency: 0.75 },
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

## Design Decisions

### Sensors Come from Skills, Not Framework

The framework provides `SensorFactory` as a type contract. Skills teach agents how to generate sensors per deployment. A web search sensor, a git sensor, a filesystem sensor — these are all generated into the node's modules at deployment time, not baked into `src/agent/`.

The flow: user describes what to watch → agent reads sensor patterns from skill → agent generates `SensorFactory` implementation → code lives in the module, satisfies the framework contract.

### Vendor-Agnostic Search

Web search sensors use configurable `SEARCH_API_URL` + `SEARCH_API_KEY` via `.env.schema`. The skill teaches the shape (fetch → diff URLs → delta), the deployment chooses the provider (You.com, Brave, Tavily, SearXNG). Same pattern as the model interface — `Model.reason()` is vendor-agnostic, the adapter is plugged in at deployment.

### Multi-Agent Git Coordination via A2A (Not AgentHub)

For enterprise org scenarios (multiple worker agents on a shared codebase), coordination concepts from [AgentHub](https://github.com/ygivenx/agenthub) are adapted into existing A2A primitives rather than adding a separate Go server:

| AgentHub Concept | Plaited Equivalent |
|---|---|
| Git push/fetch | `createSshExecutor` (already exists) |
| Commit DAG browsing | `git log --graph`, `git rev-list --children` via bash tool |
| Leaves (frontier) | `git branch --no-merged` |
| Message board | A2A messages between worker nodes, PM as router |
| Coordination posts | `sensor_delta` events — PM's git sensor detects worker pushes, broadcasts |

The PM node becomes the coordination server. Workers push code, PM detects via git sensor, broadcasts to affected workers via A2A. Single auth model (mTLS), single protocol (A2A), no additional infrastructure.

## Key Difference from Autoresearch

Autoresearch optimizes one file against one scalar metric. This system optimizes **skill content** (multiple files) against **multi-dimensional grading** (outcome × process × efficiency). The loop pattern is identical; the measurement surface is richer. This means:

- Keep/discard decisions need composite score comparison, not just `<` on a scalar
- The agent must identify *which dimension* regressed and *which skill file* caused it
- Bootstrap CIs from compare-trials provide statistical confidence on improvements
