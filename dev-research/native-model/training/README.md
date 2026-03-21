# Native-Model Training Environment

This directory is the dedicated Python training project for Plaited's
native-model lane.

It is intentionally separate from the Bun/TypeScript repo root so Python
trainer dependencies do not leak into shipped framework surfaces.

## Current Target

- local bootstrap tuning on Apple Silicon with MLX LoRA/SFT
- validation, curation, and small quantized adapter runs on this machine

## Planned Later Target

- larger Linux/CUDA runs on the MSI/EdgeXpert box with a separate trainer stack
- less truncated, more meaningful Falcon training on hardware with more headroom

## Setup

```bash
cd dev-research/native-model/training
uv python install 3.12
uv venv --python 3.12
uv sync --group dev --group mlx
uv lock
```

## Smoke Test

```bash
uv run python -c "import mlx.core as mx; print(mx.default_device())"
```

If that fails, fix the MLX runtime before attempting any local tuning run.

## Python Quality Commands

```bash
uv run ruff check .
uv run ruff format .
uv run pytest
```

## First MLX LoRA Run

Prepare the MLX dataset split and print the exact training command:

```bash
TRAIN_DATASET_PATH=../evals/curated-good-outputs.jsonl \
TRAIN_OUTPUT_DIR=./runs/bootstrap-mlx \
BASE_MODEL=tiiuae/Falcon-H1-7B-Base \
uv run python train_mlx_lora.py
```

Actually start the first MLX LoRA run:

```bash
TRAIN_DATASET_PATH=../evals/curated-good-outputs.jsonl \
TRAIN_OUTPUT_DIR=./runs/bootstrap-mlx \
BASE_MODEL=tiiuae/Falcon-H1-7B-Base \
uv run python train_mlx_lora.py --run
```

## Bootstrap Cycle

Run the Bun-native bootstrap cycle to:
- train a candidate MLX adapter
- evaluate the untuned baseline
- evaluate the tuned adapter
- compare both summaries
- optionally promote the tuned adapter by updating `FALCON_ADAPTER_PATH`

```bash
bun run native-model:bootstrap-cycle -- \
  --model mlx-community/Falcon-H1R-7B-4bit \
  --max-seq-length 384 \
  --num-layers 2 \
  --iters 20
```

Add `--promote` to update `.env.schema` automatically when the tuned adapter
clears the no-regression gate.

## Notes

- `runs/` and `checkpoints/` are local artifacts and should not be committed.
- The curated training input boundary remains:
  - `../evals/curated-good-outputs.jsonl`
- The active local Falcon evaluation target is tracked in:
  - `/.env.schema` via `FALCON_ADAPTER_PATH`
- Update `FALCON_ADAPTER_PATH` when a newer adapter run is promoted as the
  local evaluation baseline.
- The first successful local bootstrap run on this machine used:
  - `mlx-community/Falcon-H1R-7B-4bit`
  - `--max-seq-length 384`
  - `--num-layers 2`
  - `--iters 20`
- That proves the loop works here, but it does not make this machine the right
  long-term Falcon training target.
