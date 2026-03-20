# Slice 3: Result Analysis & Curation

## Target

Aggregate collected native-model trial results, filter for training
suitability, and emit a curated dataset for Falcon fine-tuning.

## Scope

- collect trial metadata (judge scores, meta-verify confidence, trajectories)
- Filter by: judge > 0.85, meta-verify confidence > 0.8, richness = full
- Categorize by task type and suitability (native-model training vs framework improvement)
- Emit `/tmp/good-outputs.jsonl` with curated examples

## Required

- collected trial data accessible (attempt records, judge scores, trajectories)
- filtering logic applies the validated rubric from earlier slices
- Output format: JSONL with full context (input prompt, output code, scores, dimensions)

## Preserve

- Do not modify trial data (read-only analysis)
- Maintain provenance metadata (source run, which attempt)
- Distinguish Lane A (framework) from Lane B (native producer) suitability

## Avoid

- Cherry-picking only "easy" outputs
- Applying different judge thresholds to different workers
- Discarding low-confidence meta-verify outputs without investigation
- Filtering so aggressively that < 100 examples remain

## Acceptance Criteria

- collected trials are analyzed without data loss
- outputs meeting the filtering criteria are retained in curated form
- Curated dataset stored at `/tmp/good-outputs.jsonl`
- Distribution analysis: pass rates per task type and per dimension
- Summary report: total cost, cost per quality output, confidence distribution

## Output

**File:** `/tmp/good-outputs.jsonl`

Each line: JSONL object with:
```json
{
  "source": "native-model-collection-run",
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
- Total trials: ?
- Good outputs: ?
- Cost per quality output: ?
- Source quality variance: (range across collection runs or batches)
- Task type distribution: % modules, % UI, % bridge-code, etc.
