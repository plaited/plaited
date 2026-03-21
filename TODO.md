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

## Next Steps

1. Evaluate the successful local adapter on this machine.
   - Use the adapter output from:
     - `dev-research/native-model/training/runs/bootstrap-mlx-2026-03-21T05-05-29-567Z/adapters/adapters.safetensors`
   - Goal:
     - confirm whether the bootstrap run changes native-model outputs at all
     - treat this as adapter validation, not final quality judgment

2. Reduce truncation pressure in the training data.
   - The current run succeeded only by truncating many examples to `384` tokens.
   - Add a data-shaping step for:
     - shorter prompt/output pairs
     - chunking or splitting oversized examples
     - preserving training quality while staying within local memory limits

3. Keep this machine for lightweight bootstrap experiments only.
   - Good use cases:
     - validation
     - dataset curation
     - adapter smoke tests
     - tiny quantized LoRA runs
   - Avoid:
     - serious 7B full-context training
     - assuming non-quantized or long-context runs will fit here

4. Move meaningful Falcon training to the MSI machine.
   - Use the MSI box for:
     - longer context
     - more trainable layers
     - less truncated runs
     - repeated distillation cycles

5. Once the MSI environment is ready, reuse the same curated boundary and run manifest flow.
   - Keep:
     - `dev-research/native-model/evals/curated-good-outputs.jsonl`
     - Bun wrapper entrypoints
     - run manifests and adapter output paths
   - Swap:
     - the trainer backend and hardware target

## Short Sequence

1. Evaluate the successful local adapter.
2. Add a data-shaping step to reduce truncation.
3. Keep this Mac for validation/curation/bootstrap only.
4. Move real Falcon training to the MSI machine.

## Do Not Revisit Unless Needed

- Do not rerun `runtime-taxonomy`.
- Do not go back to the old `native-model` worker-split plan.
- Do not use `scripts/dev-autoresearch.ts` as the native-model data collection loop itself.
- Do not assume a successful bootstrap LoRA run on this Mac means it is the right machine for sustained Falcon training.
