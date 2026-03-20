# Slice 4: Falcon Fine-Tuning

## Target

Fine-tune a Falcon-family base model on curated Plaited-native training data
from Slice 3.

## Scope

- Load curated dataset from Slice 3
- Train a Falcon-family model using parameter-efficient fine-tuning
- Save checkpoint for evaluation (Slice 5)
- Log training metrics: loss, convergence, token efficiency

## Required

- Curated training data from Slice 3
- Falcon-family base model available locally
- Training stack chosen for the actual hardware in use
  - QLoRA is the default baseline
  - See `scripts/VLLM_SETUP.md` only if the selected environment needs it
- Local compute suitable for fine-tuning
- Training script with:
  - Data loading from JSONL
  - LoRA rank/alpha hyperparameters
  - Learning rate, batch size, epochs
  - Checkpoint saving to a stable model output path

## Preserve

- Base model integrity (only adaptation weights modified)
- Training data integrity (read-only from Slice 3)
- Reproducibility (seed, hyperparams logged)

## Avoid

- Full parameter fine-tune unless a later phase explicitly justifies it
- Overfitting to a small curated dataset
- Training so long that model memorizes corpus
- Discarding base model weights (needed for fallback)

## Acceptance Criteria

- Training completes without errors
- Checkpoint saved with LoRA weights
- Baseline and fine-tuned models can both run inference on the target setup
- Training logs show convergence (loss decreasing)
- At least 1 epoch completed on the curated dataset
- Hyperparameters and environment details are recorded with the output

## Hyperparameters (Baseline)

```
Model: Falcon-family base model
Method: QLoRA
LoRA rank: 8
LoRA alpha: 32
Learning rate: 2e-4
Batch size: 4 (per-device)
Epochs: 1-3
Max seq length: 2048
```

## Input Dataset

Expected source:

- `./dev-research/native-model/evals/curated-good-outputs.jsonl`

If a different stable path is chosen, document it together with the training
run so Slice 5 can reproduce the comparison.

## Output

**File:** stable model output path chosen for the training run

Contains:
- LoRA weights (rank 8, alpha 32)
- Training metadata (hyperparams, data count, loss)
- Timestamp and git commit hash
