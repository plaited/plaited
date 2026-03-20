# Slice 2: Parallel Data Collection - Worker Template

## Target

Run 375 autoresearch attempts on a single worker thread, generating high-quality Plaited-native code for distillation training data.

**Note:** This slice is run 8 times in parallel (workers 1-8), each on its own feature branch. No coordination between workers.

## Scope

- 375 sequential autoresearch attempts
- Each attempt: Codex generate → Sonnet judge → Haiku meta-verify → keep/revise/discard
- Feature branch: `native-model-worker-{N}` where N = 1-8
- Results automatically committed to worker branch
- All trajectory data, scores, and metadata captured

## Required

- Codex CLI subscription available (CODEX_API_KEY or equivalent)
- Sonnet API access for judging (ANTHROPIC_API_KEY)
- Haiku meta-verifier access (same API key)
- Test cases from Slice 1 loaded and ready
- Judge rubric and thresholds from Slice 1 applied consistently

## Preserve

- Autoresearch loop unchanged (keep/revise/discard workflow)
- Judge score > 0.85 threshold for keep decisions
- Meta-verifier confidence captured on every trial
- Trajectory richness (full/minimal/messages-only) recorded
- Worker branch isolation maintained (no cross-worker merges)

## Avoid

- Modifying judge thresholds mid-run
- Interrupting a worker and resuming elsewhere
- Merging worker branches before Slice 3 analysis
- Logging verbosity that slows inference

## Acceptance Criteria

- 375 attempts completed on this worker (no early stopping)
- Results committed to worker branch with attempt DAG + provenance
- At least 100 trials scored (> 0.85 judge score) for training data
- Metrics logged: total time, pass rate, avg judge score, avg confidence
- No timeouts or crashes in final run

## Execution

```bash
# On EdgeXpert machine, launch all 8 workers in parallel:
for i in {1..8}; do
  bun run research:overnight -- ./dev-research/native-model/slice-2-worker.md \
    --adapter ./scripts/codex-cli-adapter.ts \
    --judge \
    --max-attempts 375 &
done

# Wait for all to complete
wait

# Results appear on branches:
#   native-model-worker-1
#   native-model-worker-2
#   ... through native-model-worker-8
```

## Output

Each worker produces:
- **Feature branch** with 375 commits (one per keep decision)
- **Attempt DAG** tracking lineage and revisions
- **Result metadata** with judge scores, meta-verify confidence, token counts
- **Trajectory data** for training (if richness = full)

Slice 3 will merge and analyze all worker results.

## Notes

- Total wall-clock time for all 8: ~6-8 hours (parallelized on EdgeXpert)
- Expected good outputs (score > 0.85): ~30-50 per worker = ~300 total
- Cost per worker: ~$17-20 (Sonnet/Haiku only; Codex subscription amortized)
- Expect varying pass rates per worker (some themes harder than others)
