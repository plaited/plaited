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

## Phase 7 — Full Node Generation Eval

### Prompt 17: Personal Agent Node Generation + Grader

```
Work in a worktree branch off local dev branch.

## Task

Add 5 personal-agent node generation prompts and a node-grader that tests
full composition — workspace + modules + sensors + goals + constitution +
notification channels + varlock. This is the integration test for the entire
framework: can a frontier agent compose all skills into a working node?

## Context

Module eval (25 prompts) validates individual artifacts. Proactive eval
(5 prompts) validates sensors and goals. But nothing tests the full
composition path: initNodeWorkspace → initModule (MSS) → constitution →
createAgentLoop (proactive) → createNode (server + A2A) → varlock (.env.schema).

The skills exist (modnet-node, mss-vocabulary, agent-loop, proactive-node,
constitution, varlock). The framework primitives exist (workspace.ts, node.ts,
proactive.ts, agent.loop.ts). This prompt validates that a frontier agent
can read the skills and generate a complete working node.

## Requirements

1. Create `skills/node-generation/assets/prompts.jsonl` with 5 prompts:

   a. **GitHub Watcher** — "Generate a personal agent node that monitors
      my GitHub repos for new issues and alerts me via Discord webhook"
      (workspace + git sensor + alert goal + webhook notifier + varlock)

   b. **Expense Tracker** — "Generate a personal agent node that
      categorizes my expenses and emails me a weekly summary"
      (workspace + finance module/MSS + schedule goal + email notifier)

   c. **Competitor Monitor** — "Generate a personal agent node that watches
      a competitor's pricing page and alerts me when prices change"
      (workspace + HTTP sensor + alert goal + webhook + varlock)

   d. **Personal Knowledge Base** — "Generate a personal agent node that
      indexes my notes folder and answers questions about my documents"
      (workspace + education module + filesystem sensor, no notification)

   e. **Team Standup Bot** — "Generate a personal agent node that collects
      daily updates from team members via Slack and posts a morning summary"
      (workspace + social module/MSS + schedule goal + webhook in/out)

2. Create a grader (`src/tools/node-grader.ts`) with five dimensions:

   - **Structure** — workspace exists, package.json valid, MSS tags valid
     against mss-vocabulary, module has own git init
   - **Composition** — createNode() or createAgentLoop() call present,
     proactive config wired with sensors + goals
   - **Constitution** — MAC rules present (at minimum default protectGovernance),
     governance factories used correctly
   - **Secrets** — .env.schema exists for any API keys/webhooks,
     @sensitive markers present, no hardcoded secrets in code
   - **Integration** — tsc --noEmit passes on the generated node

3. Create a `skills/node-generation/SKILL.md` that teaches the full
   composition pattern — the "plaited genome" in skill form:

   Wave 0: Initialize workspace (initNodeWorkspace)
   Wave 1: Create module(s) with MSS tags (initModule)
   Wave 2: Add constitution (MAC factories)
   Wave 3: Wire proactive mode (sensors + goals + heartbeat)
   Wave 4: Add notification channels
   Wave 5: Configure secrets (.env.schema via varlock)
   Wave 6: Compose node (createNode with all pieces)

   Each wave references the specific skill that teaches it.

## Key Files

- skills/node-generation/SKILL.md — NEW (composition patterns)
- skills/node-generation/assets/prompts.jsonl — NEW (5 prompts)
- src/tools/node-grader.ts — NEW (5-dimension grader)
- scripts/run-eval.ts — may need node-generation adapter
- src/tools/module-grader.ts — reference for grader patterns
- src/tools/proactive-grader.ts — reference for grader patterns

## Constraints

- Each prompt must be self-contained — frontier agent receives prompt + skills
- The grader must validate MSS tags against mss-vocabulary valid combinations
- tsc --noEmit is the hard gate — if it fails, the node is broken
- .env.schema must exist if any secret is referenced (varlock enforcement)
- Prompts should cover diverse MSS contentTypes, boundaries, and scales
- Follow existing JSONL format from modnet-modules and proactive-node prompts
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
