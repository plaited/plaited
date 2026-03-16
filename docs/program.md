# Overnight Research Program

> **For:** Autonomous overnight session (`PLAITED_AUTO_RESEARCH=1 claude`)
> **Never-stop rule:** Do not stop until `PLAITED_MAX_EXPERIMENTS` is reached or you are explicitly interrupted.

## Current State (as of 2026-03-16)

- **Variant 1 (Skill Calibration): COMPLETE** — 20/20 prompts at pass@3=1.00 after 12 experiments
- Baseline composite: 0.99 across all dimensions (I/S/D)
- All fixes committed and pushed to `dev`

## Tonight's Goal: Trajectory Collection for SFT

With calibration complete and the grader well-calibrated, the high-value overnight task is collecting **high-quality generation trajectories** for supervised fine-tuning (SFT). Each passing trial produces a trajectory (tool calls, reasoning steps, file writes) that becomes a training example.

### Phase 1 — Bulk Trajectory Collection (k=10 per prompt)

Run all 20 prompts at k=10 to collect 200 trajectory samples:

```bash
bun run scripts/run-eval.ts --k 10 --concurrency 1 --progress
```

- Only passing trials produce useful trajectories (filter: `pass=true`)
- With 20/20 pass@3=1.00, expect ~190+ passing trajectories
- Each JSONL entry in `.memory/evals/trial-*.jsonl` contains the full trajectory
- Results auto-commit and push via `persistTrialResults`

After this run, commit a summary:
```typescript
await commitExperiment('trajectory collection k=10 all 20 prompts')
await logExperiment({
  commit: '<sha>',
  scores: { /* avg from results */ },
  passRate: /* overall passRate */,
  status: 'keep',
  description: 'k=10 trajectory collection: N/200 passing',
  timestamp: new Date().toISOString(),
  prompts: [/* all 20 */],
})
```

### Phase 2 — Expand the Prompt Set

If Phase 1 completes before morning, add 5 new prompts to `skills/modnet-modules/assets/prompts.jsonl` covering gaps in the current 20:

Suggested additions (currently missing):
- `recipe-manager` — Data domain, boundary:none, list structure
- `habit-tracker` — Data domain, boundary:none, steps structure
- `crypto-tracker` — Finance/social domain, boundary:none, collection
- `code-snippets` — Tools domain, boundary:none, collection
- `quiz-builder` — Education domain, boundary:all, steps

For each new prompt:
1. Write the prompt JSONL entry with `eval_ref.intention/static/dynamic`
2. Run k=1 to verify it passes
3. If grader fails, adjust eval_ref (not the prompt) until calibrated
4. Run k=3 to confirm reliability

### Phase 3 — If Time Remains

Run `bun run scripts/run-eval.ts --k 3 --concurrency 1` on all 25 prompts (20 original + 5 new) to build the expanded baseline.

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
