# Overnight Research Program

> **For:** Autonomous overnight session (`PLAITED_AUTO_RESEARCH=1 claude`)
> **Never-stop rule:** Do not stop until `PLAITED_MAX_EXPERIMENTS` is reached or you are explicitly interrupted.

## Current State (updated 2026-03-16 night)

- **Variant 1 (Skill Calibration): COMPLETE** — 20/20 prompts at pass@3=1.00 after 13 experiments
- **Phase 6 (SFT k=1): COMPLETE** — 17/20 pass quality gate, 17 trajectories saved (exp #15)
  - Dropped: inventory-manager (S:0.83), reading-list (S:0.83), bluesky-client (S:0.86)
- **Phase 2 (prompt expansion): COMPLETE** — 5 new prompts calibrated, all I:1.00 S:1.00 D:1.00 (exp #16)
  - recipe-manager: produce/collection MSS fix; quiz-builder: boundary:ask + eval_ref vocab fix
- **Phase 3 (k=3 expanded baseline)**: running — 25 prompts × 3 trials (exp #17 in progress)

### Experiment Queue

| # | Task | Status |
|---|------|--------|
| 14 | recipe-manager MSS calibration | DONE |
| 15 | Phase 6 SFT k=1 all 20, quality gate | DONE — 17/20 trajectories |
| 16 | Phase 2 k=1 calibration all 5 new prompts | DONE — all 1.00 |
| 17 | Phase 3 k=3 baseline on all 25 prompts | Running |
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

- `recipe-manager` — Data/Culinary, contentType:produce, collection, boundary:none ✓ calibrated
- `habit-tracker` — Data/Habit, contentType:health, steps, boundary:none ✓ calibrated
- `crypto-tracker` — Finance, contentType:finance, collection, boundary:none ✓ calibrated
- `code-snippets` — Tools, contentType:tools, collection, boundary:none ✓ calibrated
- `quiz-builder` — Education, contentType:education, steps, boundary:ask ✓ calibrated

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
