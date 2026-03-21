# Slice 5: Native-Model Training Eligibility Capture

## Target

Improve the native-model validation path so successful trial runs can capture
rich enough trajectories to become training-eligible, not just validation-pass.

This slice should respond directly to the latest validation outcome:

- validation pass rate is now stable
- retained outputs are being labeled correctly
- training eligibility is still `0` because capture richness remains
  `messages-only`

## Scope

- `./package.json`
- `src/improve.ts`
- `src/improve/`
- `scripts/codex-cli-adapter.ts`
- `scripts/falcon-h1r-mlx-adapter.ts`
- `scripts/improve-native-model-validation.ts`
- `scripts/improve-native-model-validation-grader.ts`
- `scripts/tests/`
- `dev-research/native-model/`
- `dev-research/native-model/evals/`

## Required

- improve captured trial trajectory richness for the native-model validation
  path
- preserve the current validation-pass behavior and reporting improvements from
  Slice 4
- make training-eligibility evaluation depend on richer captured evidence rather
  than only `messages-only` transcripts
- keep provider-specific capture logic in `scripts/`
- keep reusable reporting and trial data structures in `src/improve/`

## Preserve

- the validation driver remains trial-layer based
- provider/model bindings stay outside `src/`
- validation success and training eligibility remain distinct states
- the current two-prompt validation batch remains runnable with the existing
  package script

## Avoid

- changing this into broad dataset curation
- weakening eligibility rules just to force non-zero eligibility
- moving adapter-specific capture details into framework runtime surfaces
- expanding prompt count before training eligibility works for the current
  prompt set

## Acceptance Criteria

- the native-model validation path captures richer per-trial evidence than the
  current `messages-only` shape
- at least some successful validation trials can become training-eligible when
  their captured evidence is sufficiently rich
- summaries and JSONL results make it clear why a trial is or is not
  training-eligible
- `bun run native-model:validate -- --adapter ./scripts/codex-cli-adapter.ts`
  remains the primary way to exercise the flow
- changes remain bounded to the trial/improve substrate, validation driver, and
  adapter capture surfaces

## Notes

This slice is not about tuning the model yet.

It is about closing the last gap between:

- "the native-model validation path works"
- and
- "the native-model validation path can produce retained outputs suitable for
  later curation and local tuning"
