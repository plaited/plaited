# TODO

## Current State

- `runtime-taxonomy` is effectively complete enough to stop touching for now.
- `skills/slice-1`, `improve/slice-1` through `improve/slice-5`, and the current `native-model` prep slices all landed on `dev`.
- Native-model validation runs through the trial layer via:
  - `bun run native-model:validate -- --adapter ./scripts/codex-cli-adapter.ts`
- The curated training set exists at:
  - `dev-research/native-model/evals/curated-good-outputs.jsonl`
- The first local MLX LoRA bootstrap run has now succeeded on this Mac with:
  - base model: `mlx-community/Falcon-H1R-7B-4bit`
  - `--max-seq-length 384`
  - `--num-layers 2`
  - `--iters 20`
  - output:
    - `dev-research/native-model/training/runs/bootstrap-mlx-2026-03-21T05-05-29-567Z/adapters/adapters.safetensors`
- Meaning:
  - the end-to-end local tuning loop works on this machine
  - this machine can handle a small quantized bootstrap run
  - this machine is still too constrained for less-truncated or less-quantized 7B training

## Immediate Goal

Use this machine as the control plane for validation, curation, adapter evaluation, and data-shaping.
Use the MSI machine as the serious training plane once it is ready.

The native-model plan is now explicitly staged:

1. symbolic output quality
2. tool-aware process behavior
3. autonomous improvement loops

The local Falcon comparison now confirms:
- untuned local Falcon is weak on controller-compatible UI
- the tiny tuned MLX adapter did not improve pass rate
- the tuned adapter regressed average score slightly
- this Mac workflow is valid, but not a promotion-quality training path

## Next Steps

1. Finish Layer 1 first: symbolic output quality.
   - Keep using manually authored validation prompts plus curated retained
     outputs as the stable training boundary.
   - Continue training Falcon on Plaited-native symbolic artifacts:
     - modules
     - controller-compatible UI
     - BP/runtime wiring
     - provenance-aware structures
   - Do not confuse this with tool-use or autonomous improvement training yet.

2. Evaluate the successful local adapter on this machine.
   - Use the adapter output from:
     - `dev-research/native-model/training/runs/bootstrap-mlx-2026-03-21T05-05-29-567Z/adapters/adapters.safetensors`
   - Keep `FALCON_ADAPTER_PATH` in `.env.schema` pointed at the currently
     promoted adapter run so `bun run falcon:mlx` continues to target the
     tracked local baseline.
   - Goal:
     - confirm whether the bootstrap run changes native-model outputs at all
     - treat this as adapter validation, not final quality judgment

3. Reduce truncation pressure in the training data.
   - The current run succeeded only by truncating many examples to `384` tokens.
   - Add a data-shaping step for:
     - shorter prompt/output pairs
     - chunking or splitting oversized examples
     - preserving training quality while staying within local memory limits

4. Keep this machine for lightweight bootstrap experiments only.
   - Good use cases:
     - validation
     - dataset curation
     - adapter smoke tests
     - tiny quantized LoRA runs
   - Avoid:
     - serious 7B full-context training
     - assuming non-quantized or long-context runs will fit here

5. Move meaningful Falcon training to the MSI machine.
   - Use the MSI box for:
     - longer context
     - more trainable layers
     - less truncated runs
     - repeated distillation cycles
   - Reuse:
     - `bun run native-model:bootstrap-cycle`
     - `bun run native-model:compare`
     - `bun run program:run -- ... --lane native-model --pattern fanout`
     - the same curated dataset boundary
   - Replace:
     - MLX trainer backend
     - local Falcon server backend as needed for the MSI environment
   - MSI follow-up:
     - revisit `scripts/program-orchestrator.ts` native-model fanout so it can
       run candidate strategies in parallel when the MSI box has enough GPU
       headroom
     - add explicit concurrency/worker controls instead of assuming one-machine
       sequential execution
     - isolate candidate eval serving with distinct ports and output dirs before
       enabling parallel native-model fanout

6. Once the MSI environment is ready, reuse the same curated boundary and run manifest flow.
   - Keep:
     - `dev-research/native-model/evals/curated-good-outputs.jsonl`
     - Bun wrapper entrypoints
     - run manifests and adapter output paths
   - Swap:
     - the trainer backend and hardware target
   - After MSI bring-up:
     - continue Layer 1 with better headroom
     - then begin Layer 2 by adding tool-aware process traces
     - keep Layer 3 for later, after Layer 2 data and evaluation are stable

## Short Sequence

1. Finish Layer 1 symbolic-output training boundaries and eval loops.
2. Evaluate the successful local adapter.
3. Add a data-shaping step to reduce truncation.
4. Keep this Mac for validation/curation/bootstrap only.
5. Move real Falcon training to the MSI machine.
6. Run the first MSI baseline vs tuned comparison before promoting anything.
7. Only after Layer 1 is stable, start Layer 2 tool-aware process training.
8. Keep Layer 3 autonomous-improvement training as a later phase.

## Do Not Revisit Unless Needed

- Do not rerun `runtime-taxonomy`.
- Do not go back to the old `native-model` worker-split plan.
- Do not use `scripts/dev-autoresearch.ts` as the native-model data collection loop itself.
- Do not assume a successful bootstrap LoRA run on this Mac means it is the right machine for sustained Falcon training.

## Validation Follow-Up

- The current browser-test gating in `scripts/dev-autoresearch.ts` is correct
  for framework-repo slices like `runtime-taxonomy`, where browser/controller
  tests should only run when UI paths are actually impacted.
- This is not the final policy for deployed module generation or user-facing
  agent tooling.
- Later work should add task-specific validation profiles so:
  - framework repo slices keep impact-gated browser tests
  - generated module / controller work can run module-specific browser
    validation by default
  - future AgentHub-style breadth executors can choose validation policy per
    lane instead of inheriting one repo-wide rule
