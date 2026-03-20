# Slice 4: Falcon Fine-Tuning

## Target

Fine-tune Falcon 7B on curated Plaited-native training data from Slice 3.

## Scope

- Load curated dataset: `/tmp/good-outputs.jsonl` (~300 high-quality examples)
- Train Falcon 7B using QLoRA (quantized low-rank adaptation)
- Save checkpoint for evaluation (Slice 5)
- Log training metrics: loss, convergence, token efficiency

## Required

- Curated training data from Slice 3
- Falcon 7B base model (local or HuggingFace)
- QLoRA setup (bitsandbytes, PEFT, or equivalent)
- GPU/local compute for training (~2-4 hours on EdgeXpert)
- Training script with:
  - Data loading from JSONL
  - LoRA rank/alpha hyperparameters
  - Learning rate, batch size, epochs
  - Checkpoint saving

## Preserve

- Falcon 7B base model integrity (only LoRA weights modified)
- Training data integrity (read-only from Slice 3)
- Reproducibility (seed, hyperparams logged)

## Avoid

- Full parameter fine-tune (QLoRA keeps cost low)
- Overfitting to 300 examples (validate with held-out set)
- Training so long that model memorizes corpus
- Discarding base Falcon weights (needed for fallback)

## Acceptance Criteria

- Training completes without errors
- Checkpoint saved with LoRA weights
- Baseline and fine-tuned models can both run inference
- Training logs show convergence (loss decreasing)
- At least 1 epoch completed on full dataset
- Memory usage on EdgeXpert < 120GB

## Hyperparameters (Baseline)

```
Model: Falcon 7B (or equivalent)
Method: QLoRA
LoRA rank: 8
LoRA alpha: 32
Learning rate: 2e-4
Batch size: 4 (per-device)
Epochs: 1-3
Max seq length: 2048
```

## Output

**File:** `./models/falcon-7b-native-model.qlora`

Contains:
- LoRA weights (rank 8, alpha 32)
- Training metadata (hyperparams, data count, loss)
- Timestamp and git commit hash
