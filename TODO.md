# TODO

## Current Focus

- `modnet` is the active lane.
- The current production judge stack for raw-card inclusion is:
  - `glm-5`
  - `minimax-m2.5`
- Keep this file focused on the modnet curation and regeneration pipeline until
  that lane is stable again.

## Modnet Order Of Operations

The raw-card corpus and retained corpus already exist. The next modnet steps
are:

1. Rerun the full raw-card inclusion lane with the calibrated prompt pair.
   - Input:
     - `dev-research/modnet/catalog/modnet-raw-card-corpus.jsonl`
     - `/tmp/modnet-raw-card-inclusion-candidates.jsonl`
   - Output:
     - `/tmp/modnet-raw-card-inclusion-evals.jsonl`
   - Judge stack:
     - `glm-5`
     - `minimax-m2.5`

2. Rebuild the retained raw corpus from the calibrated inclusion results.
   - Input:
     - `/tmp/modnet-raw-card-inclusion-evals.jsonl`
   - Output:
     - `dev-research/modnet/catalog/modnet-retained-raw-card-corpus.jsonl`

3. Run Slice 14 regeneration sample over a bounded retained subset first.
   - Compare:
     - `base_1`
     - `base_1_search`
     - `base_1_search_followup_livecrawl`
   - Pick the winning regeneration path before the full retained-corpus run.

4. Run Slice 14 regeneration over the full retained raw corpus.
   - Generate the three allowed variants:
     - `base_1`
     - `base_1_search`
     - `base_1_search_followup_livecrawl`
   - Write:
     - regeneration candidates
     - regeneration evaluations
     - variant comparison
     - final regenerated prompt-set artifact

5. Run Slice 15 sample seed review on `100` regenerated prompts at `--concurrency 5`.
   - Check:
     - trusted rate `>= 0.90`
     - recommended-for-seed-review rate between `0.20` and `0.40`
     - no obvious family/structure collapse
     - spend remains in the same general band as the current HyperCard lane

6. If the sample passes, run seed review over the full regenerated prompt set.

7. Curate the approved regenerated seeds and decide promotion policy.
   - handcrafted prompts remain the control set
   - regenerated HyperCard prompts become the curated breadth set

8. Run Slice 16.
   - use handpicked approved seeds to refine lower-scale derivation
   - derive stronger `S1-S3` precursor prompts from the regenerated seed set

9. Keep Codex as the generation and implementation surface.
   - do not change the active Codex path to Codex `--oss`
   - do not make alternative generation-model experiments part of the current
     modnet execution path
