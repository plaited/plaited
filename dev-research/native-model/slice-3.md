# Slice 3: Result Analysis & Curation

## Target

Aggregate results from 8 parallel workers, filter for training suitability, emit curated dataset for Falcon fine-tuning.

## Scope

- Merge all worker branches (native-model-worker-1 through native-model-worker-8)
- Collect trial metadata (judge scores, meta-verify confidence, trajectories)
- Filter by: judge > 0.85, meta-verify confidence > 0.8, richness = full
- Categorize by task type and suitability (native-model training vs framework improvement)
- Emit `/tmp/good-outputs.jsonl` with curated examples

## Required

- All 8 worker branches completed and committed
- Trial data accessible (attempt DAGs, judge scores, trajectories)
- Filtering logic: apply Slice 1 rubric thresholds
- Output format: JSONL with full context (input prompt, output code, scores, dimensions)

## Preserve

- Do not modify trial data (read-only analysis)
- Keep worker branches intact (for reproducibility)
- Maintain provenance metadata (which worker, which attempt)
- Distinguish Lane A (framework) from Lane B (native producer) suitability

## Avoid

- Cherry-picking only "easy" outputs
- Applying different judge thresholds to different workers
- Discarding low-confidence meta-verify outputs without investigation
- Filtering so aggressively that < 100 examples remain

## Acceptance Criteria

- All 3,000 trials collected and analyzed
- ~300 outputs meet filtering criteria (judge > 0.85, confidence > 0.8, full trajectory)
- Curated dataset stored at `/tmp/good-outputs.jsonl`
- Distribution analysis: pass rates per worker, per task type, per dimension
- Summary report: total cost, cost per quality output, confidence distribution
- No data loss or corruption

## Output

**File:** `/tmp/good-outputs.jsonl`

Each line: JSONL object with:
```json
{
  "worker": "native-model-worker-1",
  "attempt": 42,
  "prompt": "...",
  "output": "...",
  "judge_score": 0.88,
  "judge_dimensions": { "architecture": 0.9, "boundedness": 0.85, "focus": 0.88, "quality": 0.85 },
  "meta_confidence": 0.82,
  "trajectory": [ ... ],
  "task_type": "module",
  "lane": "B"
}
```

**Summary metrics:**
- Total trials: 3,000
- Good outputs: ~300
- Cost per quality output: ~$140 / 300 = ~$0.47
- Worker quality variance: (range of pass rates across 8 workers)
- Task type distribution: % modules, % UI, % bridge-code, etc.
