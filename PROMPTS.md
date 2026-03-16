# Worktree Prompts — Final Phase

Framework refinement via frontier agent evaluation. Skills calibrated by generating modnet modules, grading results, and iterating. SFT data collected from successful trajectories.

## Completed

| # | Prompt | Result |
|---|---|---|
| 1 | Fix grader cleanup + old package refs | 0 orphaned dirs, refs cleaned |
| 2 | Module-per-repo workspace utilities | `src/modnet/workspace.ts` |
| 3 | Server + agent integration | `createNode` factory in `src/modnet/node.ts` |
| 4 | Model implementations | OpenAI-compat, Anthropic, Gemini in `src/agent/models/` |
| 5 | MSS vocabulary skill | `skills/mss-vocabulary/` (45 lines + 18 patterns) |
| 6 | Enrich modnet-node skill | 97 → 366 lines |
| 7 | Trial adapters + eval persistence | `src/tools/adapters/`, `.memory/evals/` persistence |
| 8 | Module generation prompts + grader | 20 prompts, 741-line module-grader, Bluesky flagship |
| 9 | Eval cycle + calibrate | 5 runs, 3 calibration passes, **100% pass@k≥0.66 (20/20)** |

### Eval Results Summary (Latest — Calibration Pass 3)

| Domain | Prompts | Avg Score | Notes |
|---|---|---|---|
| Data | 4 | 0.98 | diet-tracker, expense-logger, inventory, reading-list |
| Social | 3 | 0.99 | bluesky-client (0.97), chat (1.0), forum (1.0) |
| Visualization | 3 | 0.93 | interactive-map lowest at 0.86 |
| Tools | 4 | 0.97 | all strong |
| Creative | 3 | 0.96 | drawing-canvas complex but solid |
| Science | 3 | 0.88 | physics-simulator at 0.65 (hardest prompt) |

---

## Remaining: Phase 4 — Distillation Data Collection

### Prompt 10: Collect SFT Trajectories from Frontier Agents

```
Work in a worktree branch off local dev branch.

## Task

Collect successful generation trajectories from frontier agents for SFT distillation.

## Context

The eval cycle (Prompt 9) achieved 100% pass rate across 20 module generation prompts with 3 calibration passes. Skills are calibrated. Now we need to collect high-quality trajectories from frontier agents for supervised fine-tuning of our target model (Falcon-H1R 7B).

5 trial result files exist in .memory/evals/ from the eval cycles. The latest (calibration pass 3) shows 20/20 pass@k≥0.66 with avg scores 0.65-1.0.

## Process

### 1. Select Prompts for Trajectory Collection

All 20 prompts from skills/modnet-modules/assets/prompts.jsonl. Focus trajectory collection on:
- All prompts with avg score ≥ 0.9 (baseline trajectories)
- physics-simulator separately (hard prompt, need multiple attempts for diversity)

### 2. Re-run with Rich Trajectory Capture

For each prompt, run with trajectory capture enabled through multiple frontier agents:

**Claude Code (primary distillation source):**
```bash
bun run scripts/run-eval.ts --adapter adapters/claude-code --prompts skills/modnet-modules/assets/prompts.jsonl --k 1 --capture-trajectory --output trajectories/claude-code/
```

**Gemini CLI (alternative reasoning patterns):**
```bash
bun run scripts/run-eval.ts --adapter adapters/gemini --prompts skills/modnet-modules/assets/prompts.jsonl --k 1 --capture-trajectory --output trajectories/gemini/
```

**Codex (different tool-calling patterns):**
```bash
bun run scripts/run-eval.ts --adapter adapters/codex --prompts skills/modnet-modules/assets/prompts.jsonl --k 1 --capture-trajectory --output trajectories/codex/
```

The trajectory includes: thinking, tool calls, tool results, file operations, final output.

### 3. Quality Gate

For each captured trajectory:
1. Run module-grader on the output
2. Only keep trajectories where ALL three dimensions pass:
   - intention ≥ 0.8
   - static = 1.0 (must pass all structural checks)
   - dynamic ≥ 0.7
3. Run withStatisticalVerification (k=5) to check grader consistency
4. Discard trajectories where grader is inconsistent (stddev > 0.2)

### 4. Format for SFT

Convert captured trajectories to SFT training format:

```jsonl
{"messages": [{"role": "system", "content": "<system prompt from context assembly>"}, {"role": "user", "content": "<module generation prompt>"}, {"role": "assistant", "content": "<full trajectory: thinking + tool calls + code output>"}]}
```

Include DecisionStep metadata from BP snapshots as process signal:
```jsonl
{"messages": [...], "decision_steps": [{"superstep": 1, "selected": "invoke_inference", ...}, ...], "grading": {"intention": 0.95, "static": 1.0, "dynamic": 0.85, "composite": 0.93}}
```

### 5. Multi-Agent Diversity Analysis

After collecting from all three agents, analyze:
- Which prompts do different agents solve differently?
- Where do reasoning patterns diverge?
- Which trajectories produce the highest composite scores?

Use compare-trials skill patterns for cross-agent analysis.

### 6. Persist Trajectories

Trajectory files go in `trajectories/` directory (gitignored — too large for git, backed up separately).
SFT-formatted data goes in `training-data/` (gitignored, backed up).
Summary metadata (which trajectories passed, scores, agent source) committed to `.memory/evals/` as JSONL.

## Key Files

- scripts/run-eval.ts — eval runner
- src/tools/adapters/ — frontier agent adapters (claude-code, cli-adapter, local)
- src/tools/module-grader.ts — three-dimension grader
- src/tools/training.ts — withStatisticalVerification
- skills/modnet-modules/assets/prompts.jsonl — 20 prompts
- skills/training-pipeline/ — distillation format reference

## Estimated Cost

| Agent | Prompts × k | Est. Cost |
|---|---|---|
| Claude Opus 4.6 | 20 × 1 | ~$30-50 |
| Gemini 2.5 Pro | 20 × 1 | ~$10-20 |
| Codex | 20 × 1 | ~$5-10 |
| Quality gate grading | 60 trajectories × k=5 | ~$5-10 |
| **Total** | | **~$50-90** |

## Constraints

- Trajectories are ephemeral on disk (gitignored), backed up to cloud storage
- Only graded, verified trajectories become training data
- SFT format must match training-pipeline skill specifications
- Run module-grader on every trajectory — no ungraded data in training set
```

---

## Future Work (After Distillation)

These items are deferred until after the initial training cycle:

- **ACP debug viewport** — for debugging trained agent running on a node
- **Enterprise genome** — PM node seed generation from calibrated skills
- **Structural-IA → bThreads** — MSS enforcement rules generated from mss-vocabulary skill
- **Project isolation orchestrator** — subprocess spawning, IPC bridge
- **Proactive mode completion** — set_heartbeat tool, push notification routing
- **Session rollback/branching UX**
- **Mid-task steering**
