# TODO

## Current State

- `runtime-taxonomy` is effectively complete enough to stop touching for now.
- `skills/slice-1`, `improve/slice-1`, `improve/slice-2`, `improve/slice-3`, and `improve/slice-4` all landed on `dev`.
- Native-model validation now runs through the trial layer via:
  - `bun run native-model:validate -- --adapter ./scripts/codex-cli-adapter.ts`
- Latest successful validation run:
  - `dev-research/native-model/evals/runs/2026-03-21T01-01-26-652Z/`
- Latest validation result:
  - validation pass rate: `1.000`
  - training eligible rate: `0.000`
- Meaning:
  - prompt/grader calibration for the first two themes is now good enough for validation
  - trajectory richness is still insufficient for training/distillation

## Immediate Goal

Finish all work needed to reach the first real local tuning run on new hardware within the next 24 hours.

## Next Steps

1. Review the current training-readiness blocker in the latest validation artifacts.
   - Inspect:
     - `dev-research/native-model/evals/runs/2026-03-21T01-01-26-652Z/results.jsonl`
     - `dev-research/native-model/evals/runs/2026-03-21T01-01-26-652Z/summary.json`
   - Confirm all `trainingAssessment.eligible = false` cases are failing for `insufficient_richness`, not prompt quality.

2. Add a new bounded slice in `dev-research/improve/` for richer trial capture.
   - Goal:
     - increase captured trajectory richness beyond `messages-only`
     - keep provider-specific capture in `scripts/`
     - keep reusable types/reporting in `src/improve/`
   - Likely targets:
     - `scripts/codex-cli-adapter.ts`
     - `scripts/falcon-h1r-mlx-adapter.ts`
     - `src/improve/trial.ts`
     - `src/improve/trial-report.ts`

3. Run autoresearch on that richer-capture slice.
   - Use `research`, not manual edits, if the slice is cleanly bounded.
   - Expect success criteria to include:
     - richer trajectory capture present in JSONL
     - explicit distinction between validation-ready and training-ready outputs preserved

4. Rerun native-model validation after richer capture lands.
   - Command:
     - `bun run native-model:validate -- --adapter ./scripts/codex-cli-adapter.ts`
   - Desired result:
     - validation still passes
     - at least some trials become training-eligible

5. If training eligibility remains zero, do one more narrow pass before moving on.
   - Check whether the blocker is:
     - adapter capture richness
     - eligibility thresholds
     - missing fields in retained output
   - Do not expand prompt count yet.

6. Once some outputs are training-eligible, treat native-model Slice 2 as complete.
   - Then move to native-model Slice 3:
     - curate retained outputs into a stable dataset path
     - produce `dev-research/native-model/evals/curated-good-outputs.jsonl`

7. Prepare the first local tuning run on the new hardware.
   - Review:
     - `dev-research/native-model/slice-4.md`
     - `scripts/VLLM_SETUP.md`
     - any Falcon/MLX adapter and launch scripts in `scripts/`
   - Confirm:
     - dataset format matches training expectations
     - local adapter/server invocation path is documented
     - storage path and run naming are stable

8. Start the first real local fine-tuning/tuning pass only after:
   - validation path is stable
   - some outputs are training-eligible
   - curated dataset exists
   - local hardware path is confirmed runnable

## Short Sequence

1. Add richer-capture improve slice.
2. Run autoresearch on it.
3. Rerun `native-model:validate`.
4. Get `trainingEligible > 0`.
5. Curate dataset.
6. Run first local tuning pass.

## Do Not Revisit Unless Needed

- Do not rerun `runtime-taxonomy`.
- Do not go back to the old `native-model` worker-split plan.
- Do not use `scripts/dev-autoresearch.ts` as the native-model data collection loop itself.
- Do not expand the prompt set before training eligibility works for the current two prompts.
