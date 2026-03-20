# Slice 2G: Parallel Data Collection - Worker A

## Target

Run 375 autoresearch attempts on worker thread G, generating high-quality Plaited-native code for distillation training data.

**Worker A runs independently on feature branch `native-model-worker-g`.**

## Scope

- 375 sequential autoresearch attempts using eval themes from Slice 1
- Each attempt: Codex generate → Sonnet judge → Haiku meta-verify → keep/revise/discard
- Feature branch: `native-model-worker-g`
- Results automatically committed with attempt DAG + provenance
- All trajectory data, judge scores, meta-verify confidence, and token usage captured

## Required

- Codex CLI subscription available (CODEX_API_KEY)
- Sonnet API access (ANTHROPIC_API_KEY)
- Haiku meta-verifier access
- Eval themes and judge rubric from Slice 1
- Judge score > 0.85 threshold for keep decisions
- Meta-verifier confidence tracked on every trial

## Preserve

- Autoresearch keep/revise/discard loop intact
- Judge thresholds as defined in Slice 1
- Trajectory richness classification (full/minimal/messages-only)
- Worker branch isolation (no cross-worker merges until Slice 3)

## Avoid

- Modifying judge thresholds during execution
- Interrupting and resuming elsewhere
- Premature merging with other workers
- Verbose logging that slows inference

## Acceptance Criteria

- All 375 attempts completed on this worker
- Committed to `native-model-worker-g` with full provenance
- At least 30-50 trials scored > 0.85 (expected ~10-15% pass rate)
- Metrics logged: total time, pass rate, avg judge score, avg confidence
- No fatal errors or timeouts

## Execution

```bash
bun run research:overnight -- ./dev-research/native-model/slice-2g.md \
  --adapter ./scripts/codex-cli-adapter.ts \
  --judge \
  --max-attempts 375
```

**Note:** Launch all 8 workers (2a-2h) in parallel on EdgeXpert:
```bash
for i in {a..h}; do
  bun run research:overnight -- ./dev-research/native-model/slice-2$i.md \
    --adapter ./scripts/codex-cli-adapter.ts \
    --judge \
    --max-attempts 375 &
done
wait
```

## Output

**Feature branch:** `native-model-worker-g`

Contains:
- 375 commits (one per keep decision)
- Attempt DAG tracking revisions
- Trial metadata: judge scores, meta-verify confidence, token counts
- Trajectory data (if richness = full)

Slice 3 will aggregate all 8 worker branches and analyze results.

## Notes

- Expected pass rate: 10-15% (judge score > 0.85)
- Expected good outputs per worker: ~30-50
- Cost per worker: ~$17-20 (Sonnet/Haiku only)
- Wall-clock time for all 8 workers in parallel: ~6-8 hours (on EdgeXpert)
- Eval themes from Slice 1 define what tasks this worker tackles
