# Native-Model Training Environment

This directory is the dedicated Python training project for Plaited's
native-model lane.

It is intentionally separate from the Bun/TypeScript repo root so Python
trainer dependencies do not leak into shipped framework surfaces.

## Current Target

- local bootstrap tuning on Apple Silicon with MLX LoRA/SFT

## Planned Later Target

- larger Linux/CUDA runs on the MSI/EdgeXpert box with a separate trainer stack

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

## Notes

- `runs/` and `checkpoints/` are local artifacts and should not be committed.
- The curated training input boundary remains:
  - `../evals/curated-good-outputs.jsonl`
