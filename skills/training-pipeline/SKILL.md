---
name: training-pipeline
description: >
  Distillation pipeline design for training local models from frontier agent
  trajectories. Covers SFT/GRPO data mix, training tier selection (consumer
  LoRA vs enterprise full-parameter), augmented self-distillation stages
  (bootstrap/refinement/probing), DecisionStep as process signal, and
  cross-project knowledge transfer via weights.
license: ISC
---

# Training Pipeline

## Purpose

Design and configure the distillation pipeline that turns trial-runner trajectories into model improvements. The trial-runner captures data; this skill teaches you how to shape that data into SFT and GRPO training sets, select the right training tier, and orchestrate the distillation stages.

**Use this when:**
- Configuring a distillation pipeline from frontier agent trajectories
- Choosing between consumer (LoRA) and enterprise (full-parameter) training
- Designing SFT/GRPO data mixes from trajectory and user feedback signals
- Understanding how DecisionStep and GradingDimensions feed training weights
- Setting up cross-project knowledge transfer through model weights

## Pipeline Overview

```
Task prompts (prompts.jsonl)
  -> trial runner (teacher: frontier agent via adapter)
  -> trial runner (student: local model via adapter)
  -> compare-trials (teacher vs student trajectories)
  -> Successful teacher trajectories -> SFT fine-tuning data
  -> Comparison signal -> GRPO preference pairs
  -> Fine-tune model (full-parameter or LoRA)
  -> Re-evaluate -> repeat
```

The pipeline reuses `runTrial()` for capture/compare and adapter scripts for agent interaction. The trainer itself is an external CLI tool — the agent dispatches training runs through standard `execute`/`tool_result` events (see § Trainer Integration below).

## Signal Tiers

Four sources of training signal, ordered by richness:

| Signal | Source | Training Use | User Involved? |
|---|---|---|---|
| **Gate rejection** | BP block predicate | Immediate re-plan context (constraint violation) | No |
| **Test failure** | Real execution | Failed attempt -> rejected response for GRPO | No |
| **Test pass + user rejects** | Client interface | Agent output -> rejected, user correction -> chosen | Yes |
| **Test pass + user approves** | Client interface | Gold SFT data — correct by user's standards | Yes |

## Training Tiers

Both tiers use the same distillation pipeline — they differ in method, hardware, and reach:

| Tier | Hardware | Method | What Gets Trained |
|---|---|---|---|
| **Consumer** | Consumer GPU (RTX 4090 24GB, Mac Metal) | LoRA on attention layers via Unsloth (~5GB VRAM) | Attention heads (12/layer). SSM heads stay at checkpoint weights. |
| **Enterprise** | DGX Spark (128GB unified) or cloud (4-8x A100 80GB) | Full-parameter SFT + GRPO | All parameters — attention + Mamba-2 SSM heads (24/layer, d_state=256) + embeddings. |

### Enterprise: Full-Parameter

Full-parameter SFT + GRPO following Falcon-H1R methodology. Trains all parameters including Mamba-2 SSM heads — persistent state properties get specialized for the enterprise's tools and environment.

**Memory budget on DGX Spark (128GB unified):**

```
Model weights (fp16):     ~14GB
Optimizer states (AdamW):  ~28GB
Gradients:                 ~14GB
Activations (grad ckpt):   ~10-30GB
Total:                     ~66-86GB of 128GB available
```

GRPO rollouts fit in remaining memory with reduced group size (4-8 rollouts vs TII's 16).

### Consumer: LoRA

LoRA on attention layers with a quantized base model (~5GB VRAM). Cannot directly update Mamba-2 SSM parameters, but attention layers learn representations tuned to the consumer's environment. Mamba's persistent state accelerates adaptation — recurring patterns reinforce across sessions without retraining.

## SFT Data Mix

Both tiers draw from three data categories:

1. **Reasoning traces** — Tool-call trajectories distilled from frontier agents. The model learns tool-call format, decision patterns, and `<think>` reasoning structure.

2. **State transition pairs (Dreamer training)** — Trajectory replay from the hypergraph. Each pair is `(Context + Tool Call) -> (Real Tool Output)`, formatted with the State Transition Prompt. Teaches the Dreamer capability — how tools behave, how compilers return errors, how file writes change directory state.

3. **Deployment usage + user feedback** — Real-world trajectories and user preference signals. Successful trajectories become SFT data; failed + corrected trajectories become GRPO preference pairs.

## Training Data from the Hypergraph

The hypergraph captures full BP decision state at each step — what was blocked, interrupted, and why. Trajectories are slices of the JSON-LD decision history:

```
JSON-LD decision files (by project, time range, outcome)
  -> Filter: successful task trajectories -> SFT data
  -> Filter: failed tasks + corrections -> GRPO preference pairs
  -> Filter: recurring blocking patterns -> bThread candidates -> Owner approval
```

Training data extraction is a query over the hypergraph, not a separate export pipeline.

## Augmented Self-Distillation

Standard distillation treats all approved trajectories as gold SFT data. This reinforces trajectories with correct outcomes but poor reasoning. Augmented self-distillation uses process-aware training in three phases — see [distillation-stages.md](references/distillation-stages.md) for details.

| Phase | Method | Process Signal |
|---|---|---|
| Bootstrap | Expert demonstrations via adapters | Trajectory-level heuristics (no BP snapshots) |
| Refinement | k parallel self-play trajectories | BP snapshots via DecisionStep — deterministic |
| Probing | Adversarial prompts | Constitution bThread ground truth |

Training weight = `outcome x process`. Trajectories above group mean get positive GRPO advantage. See [data-format.md](references/data-format.md) for DecisionStep and GradingDimensions schemas.

## Trainer Integration

The trainer is an external CLI tool, not a built-in subsystem:

```
Agent Loop                         Trainer CLI
  |                                    |
  |  execute: bash train-wrapper.ts   |
  |  --------------------------------> |
  |    (wrapper extracts trajectories  |
  |     from hypergraph, sanitizes     |
  |     PII -> synthetic variants)     |
  |                                    |  SFT/GRPO on sanitized data
  |  tool_result: metrics + checkpoint |
  |  <-------------------------------- |
```

**PII boundary:** The wrapper module is the sanitization point — when extracting trajectories for training, it replaces sensitive data with synthetic variants. Sensitive data never reaches external training infrastructure.

## Cross-Project Knowledge Transfer

Project subprocesses have hard process boundaries. The model is the cross-project knowledge channel:

```
Project A decisions  --+
                       +--> Training pipeline (reads all partitions)
Project B decisions  --+        |
                                v
                       Updated model weights
                                |
                       +--------+--------+
                       v                 v
                 Project A            Project B
              (subprocess)         (subprocess)
            sees improved model   sees improved model
```

No subprocess reads another's memory. Knowledge transfer happens through weights.

## Log Retention

The hypergraph is append-only. Rotation moves old decision files into compressed archives:

| Tier | Storage | Purpose |
|---|---|---|
| **Hot** | JSON-LD files in git | Recent decisions — active context window |
| **Archive** | `.jsonl.gz` files (outside workspace) | Rotated decisions — replayable for training |
| **Training artifacts** | Extracted before rotation | SFT trajectories, GRPO preference pairs |

Rotation triggers: time-based, size-based, or user-triggered.

## References

- [data-format.md](references/data-format.md) — DecisionStep schema, GradingDimensions, TrainingScore, MetaVerification
- [distillation-stages.md](references/distillation-stages.md) — Bootstrap, refinement, probing phases with examples

## Related Skills

- **[trial-runner](../trial-runner/SKILL.md)** — Executing trials and capturing trajectories
- **[trial-adapters](../trial-adapters/SKILL.md)** — Writing adapter scripts for frontier/student agents
- **[compare-trials](../compare-trials/SKILL.md)** — Statistical comparison of trial results
