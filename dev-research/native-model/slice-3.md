# Slice 3: Result Analysis & Curation

## Target

Aggregate collected native-model trial results, filter for training
suitability, and emit a curated dataset for Falcon fine-tuning.

## Scope

- collect trial metadata from the validated trial layer
- filter by the validated Slice 1/2 rubric and trust thresholds
- categorize by task type and suitability
- emit a stable curated dataset for Slice 4 fine-tuning

## Required

- collected trial data accessible (trial records, judge scores, trajectories)
- filtering logic applies the validated rubric from earlier slices
- output format: JSONL with full context (prompt, output, scores, dimensions,
  suitability, provenance)

## Preserve

- do not modify source trial data (read-only analysis)
- maintain provenance metadata (source run, trial number, model identity)
- distinguish Lane A (framework) from Lane B (native producer) suitability

## Avoid

- cherry-picking only easy outputs
- applying different judge thresholds to different trial batches
- discarding low-confidence meta-verify outputs without investigation
- filtering so aggressively that the curated set becomes too narrow to train on

## Acceptance Criteria

- collected trials are analyzed without data loss
- outputs meeting the filtering criteria are retained in curated form
- curated dataset stored at a stable lane-owned path
- distribution analysis reports pass rates per task type and per dimension
- summary report covers total cost, cost per quality output, and confidence
  distribution

## Output

**File:** `./dev-research/native-model/evals/curated-good-outputs.jsonl`

Each line: JSONL object with:
```json
{
  "source": "native-model-collection-run",
  "trial_num": 2,
  "theme_id": "module-generation",
  "prompt": "...",
  "output": "...",
  "judge_score": 0.88,
  "judge_dimensions": {
    "plaited_alignment": 0.90,
    "task_fulfillment": 0.87,
    "structural_correctness": 0.86,
    "dynamic_correctness": 0.84,
    "distillation_suitability": 0.91
  },
  "meta_confidence": 0.82,
  "meta_risk": 0.12,
  "trajectory": [ ... ],
  "task_type": "module_ui_runtime",
  "lane": "B",
  "retention_label": "retain_for_distillation"
}
```

**Summary metrics:**
- Total trials: ?
- Good outputs: ?
- Cost per quality output: ?
- Source quality variance: (range across collection runs or batches)
- Task type distribution: % modules, % UI, % bridge-code, etc.
