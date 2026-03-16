# Overnight Research Program

> **For:** Autonomous overnight session (`PLAITED_AUTO_RESEARCH=1 claude`)
> **Never-stop rule:** Do not stop until `PLAITED_MAX_EXPERIMENTS` is reached or you are explicitly interrupted.

## Current State (updated 2026-03-16 evening)

- **Variant 1 (Skill Calibration): COMPLETE** — 20/20 prompts at pass@3=1.00 after 13 experiments
- k=3 full-suite baseline (exp 12): 59/60 pass (98.3%), composite 0.99 I/S/D
- physics-simulator structure:steps fix confirmed k=3 1.00 (exp 13)
- **Phase 6 (SFT k=1)**: running — `scripts/collect-trajectories.ts`
- **Phase 2 (prompt expansion)**: 5 new prompts added → calibrating k=1

### Experiment Queue

| # | Task | Status |
|---|------|--------|
| 14 | Phase 6 SFT — k=1 all 20, quality gate, log trajectories | Running (background) |
| 15 | Phase 2 — k=1 calibration: recipe-manager, habit-tracker, crypto-tracker, code-snippets, quiz-builder | Running (background) |
| 16 | Phase 2 — k=3 reliability on 5 new prompts | Queued |
| 17 | Phase 3 — k=3 baseline on all 25 prompts | Queued |
| 18-50 | k=10 collection on 25 prompts (rolling batches) | Future |

## Tonight's Goal: Trajectory Collection for SFT

With calibration complete and the grader well-calibrated, the high-value overnight task is collecting **high-quality generation trajectories** for supervised fine-tuning (SFT). Each passing trial produces a trajectory (tool calls, reasoning steps, file writes) that becomes a training example.

### Phase 1 — SFT Quality-Gated Collection (k=1 per prompt)

Run all 20 prompts k=1 with three-dimension quality gate (I≥0.8, S=1.0, D≥0.7):

```bash
bun scripts/collect-trajectories.ts
```

- Passing trajectories saved to `trajectories/claude-code/sft-{ts}.jsonl` (gitignored)
- All results persisted to `.memory/evals/` and committed
- Experiment logged via `logExperiment()`

### Phase 2 — Expand the Prompt Set

Add 5 new prompts covering gaps in the current 20:

- `recipe-manager` — Data/Culinary, contentType:health, list, boundary:none ✓ added
- `habit-tracker` — Data/Habit, contentType:health, steps, boundary:none ✓ added
- `crypto-tracker` — Finance, contentType:finance, collection, boundary:none ✓ added
- `code-snippets` — Tools, contentType:tools, collection, boundary:none ✓ added
- `quiz-builder` — Education, contentType:education, steps, boundary:all ✓ added

Calibration steps per new prompt:
1. Run k=1 to verify passes — if grader gives 0, adjust eval_ref (not the prompt)
2. Run k=3 to confirm reliability

### Phase 3 — Expanded Baseline

Run k=3 on all 25 prompts (20 original + 5 new):

```bash
bun scripts/run-eval.ts --k 3 --concurrency 1
```

### Phase 4 — Bulk Trajectory Collection (k=10)

After Phase 3 establishes reliability on 25 prompts:

```bash
bun scripts/run-eval.ts --k 10 --concurrency 1 --progress
```

- Expect ~240+ passing trajectories across 25 prompts
- Each JSONL entry in `.memory/evals/` contains the full trajectory with tool calls

## Never-Stop Rule

Continue looping through phases without stopping. When one phase completes:
1. Log the experiment with `logExperiment()`
2. Commit and push
3. Begin the next phase immediately

Do not stop to ask for confirmation. If something fails (trial error, timeout), note it in the experiment log and continue.

## Infrastructure

| Tool | Path |
|------|------|
| Eval runner | `scripts/run-eval.ts` |
| Module grader | `src/tools/module-grader.ts` |
| Adapter | `src/tools/adapters/claude-code.ts` |
| Prompts | `skills/modnet-modules/assets/prompts.jsonl` |
| Experiments log | `.memory/evals/experiments.jsonl` |
| Git keep/discard | `scripts/git-experiment.ts` |
| Results | `.memory/evals/trial-*.jsonl` (auto-committed) |
