# Worktree Prompts

## Phase 6 — Distillation Data Collection (In Progress)

### Prompt 16: Collect SFT Trajectories from Frontier Agents

```
Work in a worktree branch off local dev branch.

## Task

Collect successful generation trajectories from frontier agents for SFT distillation.

## Context

The eval cycle achieved 100% pass rate across 20 module generation prompts with
3 calibration passes. Proactive node eval (Prompt 15) provides additional coverage.
Skills are calibrated. Now we need to collect high-quality trajectories from
frontier agents for supervised fine-tuning of our target model (Falcon-H1R 7B).

5 trial result files exist in .memory/evals/ from the eval cycles. The latest
(calibration pass 3) shows 20/20 pass@k≥0.66 with avg scores 0.65-1.0.

## Process

### 1. Select Prompts for Trajectory Collection

All 20 module prompts from skills/modnet-modules/assets/prompts.jsonl plus
5 proactive prompts from skills/proactive-node/assets/prompts.jsonl. Focus on:
- All prompts with avg score ≥ 0.9 (baseline trajectories)
- physics-simulator separately (hard prompt, need multiple attempts for diversity)
- All 5 proactive prompts (new coverage, need diversity)

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
1. Run module-grader (or proactive-grader) on the output
2. Only keep trajectories where ALL three dimensions pass:
   - intention ≥ 0.8
   - static = 1.0 (must pass all structural checks)
   - dynamic ≥ 0.7
3. Run withStatisticalVerification (k=5) to check grader consistency
4. Discard trajectories where grader is inconsistent (stddev > 0.2)

### 4. Format for SFT

Convert captured trajectories to SFT training format:

```jsonl
{"messages": [{"role": "system", "content": "<system prompt from context assembly>"}, {"role": "user", "content": "<generation prompt>"}, {"role": "assistant", "content": "<full trajectory: thinking + tool calls + code output>"}]}
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
- src/tools/proactive-grader.ts — proactive artifact grader
- src/tools/training.ts — withStatisticalVerification
- skills/modnet-modules/assets/prompts.jsonl — 20 module prompts
- skills/proactive-node/assets/prompts.jsonl — 5 proactive prompts
- skills/training-pipeline/ — distillation format reference

## Estimated Cost

| Agent | Prompts × k | Est. Cost |
|---|---|---|
| Claude Opus 4.6 | 25 × 1 | ~$40-60 |
| Gemini 2.5 Pro | 25 × 1 | ~$15-25 |
| Codex | 25 × 1 | ~$5-15 |
| Quality gate grading | 75 trajectories × k=5 | ~$5-15 |
| **Total** | | **~$65-115** |

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
- **Multi-agent git coordination via A2A** — PM node monitors shared repo via git sensor, workers push via SSH executor, coordination through A2A messages. DAG browsing (children, leaves, lineage) as tools. Adapts AgentHub concepts natively into A2A rather than adding a separate server. See `docs/AUTO-RESEARCH.md`
- **Module worktree experiments** — personal agent explores multiple approaches per module via git worktrees. Same keep/discard pattern as autoresearch, module-scoped
- **Structural-IA → bThreads** — MSS enforcement rules generated from mss-vocabulary skill
- **Project isolation orchestrator** — subprocess spawning, IPC bridge
- **Web search for MSS prompt generation** — vendor-agnostic search API (Research endpoint) generates grounded domain descriptions → map to MSS tags → expand prompts.jsonl → calibrate via autoresearch loop
- **Session rollback/branching UX**
- **Mid-task steering**
