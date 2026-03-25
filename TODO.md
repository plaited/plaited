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

3. Run Slice 19 and Slice 20 before the next large Slice 14 regeneration run.
   - Slice 19:
     - verify cheap planner viability for modernization/search shaping
   - Slice 20:
     - improve the chosen `MiniMax M2.5` planner prompt and code path
   - only then rerun the next bounded Slice 14 regeneration sample

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

5. Run Slice 21 / Slice 22 first to strengthen Slice 15 seed-review context and classifier quality.
   - enrich regenerated-seed sample rows with MSS/provenance context
   - tune the reclassification judge/meta prompts for promotion review
   - improve classifier results before rerunning the Slice 15 sample

6. Run Slice 15 sample seed review on `100` regenerated prompts at `--concurrency 5`.
   - Check:
     - trusted rate `>= 0.90`
     - recommended-for-seed-review rate between `0.20` and `0.40`
     - no obvious family/structure collapse
     - spend remains in the same general band as the current HyperCard lane

7. If the sample passes, run seed review over the full regenerated prompt set.

8. Curate the approved regenerated seeds and decide promotion policy.
   - handcrafted prompts remain the control set
   - regenerated HyperCard prompts become the curated breadth set

9. Finish Slice 23 with observable worktree-backed fanout before Slice 16.
   - preserve the completed Slice 23 calibration findings:
     - mechanics continuity
     - immediate-parent / chain continuity
     - precursor contribution framing
     - handcrafted low-scale target-shape transfer
     - anti-generic anchors with selective lexical relaxation
   - rerun the next Slice 23 fanout through explicit git worktrees with per-attempt status artifacts

10. Run Slice 16.
   - use approved Slice 15 seeds plus reviewed handcrafted parent-eligible prompts
   - treat already-low-scale handcrafted prompts as target-shape references, not derivation parents
   - derive stronger `S1-S3` precursor prompts from the regenerated seed set

11. Keep Codex as the generation and implementation surface.
   - do not change the active Codex path to Codex `--oss`
   - do not make alternative generation-model experiments part of the current
     modnet execution path
