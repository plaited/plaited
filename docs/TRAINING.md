# Training: Distillation from Frontier Agents

> **Status: ACTIVE** — Extracted from SYSTEM-DESIGN-V3.md. Cross-references: `AGENT-LOOP.md` (pipeline context), `HYPERGRAPH-MEMORY.md` (JSON-LD as training source), `CONSTITUTION.md` (flywheel bThread approval).

## Overview

The framework ships with base-trained checkpoints for generative UI and general-purpose coding tasks. New deployments start useful. Over time, real-world usage generates training data from four signal tiers:

| Signal | Source | Training Use | User Involved? |
|---|---|---|---|
| **Gate rejection** | BP block predicate | Immediate re-plan context (constraint violation, not preference) | No |
| **Test failure** | Real execution | Failed attempt → rejected response for GRPO | No |
| **Test pass + user rejects** | Client interface | Agent output → rejected, user correction → chosen. Richest preference signal. | Yes |
| **Test pass + user approves** | Client interface | Gold SFT data — correct by user's standards | Yes |

## Distillation Pipeline

The model is trained via distillation from frontier agents using the existing eval harness and headless adapters — no new infrastructure required:

```
Task prompts (prompts.jsonl)
  → eval harness capture (teacher: Claude/Gemini via headless adapter)
  → eval harness capture (student: model via headless adapter)
  → eval harness compare (teacher vs. student trajectories)
  → Successful teacher trajectories → SFT fine-tuning data
  → Comparison signal (teacher-preferred vs. student-generated) → GRPO preference pairs
  → Fine-tune model (full-parameter or LoRA — both ship as skills)
  → Re-evaluate → repeat
```

This pipeline is orchestrated as a skill, reusing `agent-eval-harness` for capture/compare and `headless-adapters` for schema-driven agent interaction. The eval harness provides pass@k, pass^k, and comparison metrics — the model's improvement is measured, not assumed.

### Why Distillation, Not a Pre-trained Tool-Calling Model

Pre-trained tool-calling models (GPT-4, Claude) are trained on generic tool schemas. Our model needs:

1. **Specific tool schemas** — our tools have specific argument shapes and output formats
2. **BP-aware reasoning** — the model needs to understand that blocked actions should be re-planned, not retried
3. **Dreamer capability** — predicting state transitions requires training on `(Context + Tool Call) → (Real Output)` pairs from our specific tools
4. **Constitution awareness** — the model learns governance constraints through context assembly + experience, not generic instruction-following

Distillation from frontier agents (Claude Code, Gemini CLI) via the eval harness provides the reasoning patterns. Fine-tuning on our specific tools and BP feedback loop produces a model that's both capable and constraint-aware. See `AGENT-LOOP.md`.

## Training Tiers

The framework ships training skills for two tiers. Both use the same distillation pipeline — they differ in method, hardware, and how much of the model they can reach:

| Tier | Skill | Hardware | Method | What Gets Trained |
|---|---|---|---|---|
| **Consumer** | `training/lora` | Consumer GPU (RTX 4090 24GB, Mac with Metal) | LoRA on attention layers via Unsloth (~5GB VRAM) | Attention heads (12/layer). SSM heads remain at checkpoint weights. Meaningful but partial adaptation. |
| **Enterprise** | `training/full-parameter` | DGX Spark (128GB unified) or cloud cluster (4–8× A100 80GB) | Full-parameter SFT + GRPO | All parameters — attention heads + Mamba-2 SSM heads (24/layer, d_state=256) + embeddings. Complete adaptation. |

The framework's own shipped checkpoints are produced using the enterprise skill. Enterprise users continue building on framework checkpoints with the same tooling.

### Enterprise: Full-Parameter Training

Full-parameter SFT + GRPO following the [Falcon-H1R methodology](https://arxiv.org/abs/2601.02346). Trains all parameters including Mamba-2 SSM heads, which means the persistent state properties that make Falcon-H1R efficient at inference also get specialized for the enterprise's tools and environment.

**Memory budget on DGX Spark (128GB unified):**

```
Model weights (fp16):     ~14GB
Optimizer states (AdamW):  ~28GB
Gradients:                 ~14GB
Activations (grad ckpt):   ~10-30GB
─────────────────────────────────
Total:                     ~66-86GB of 128GB available
```

GRPO rollouts fit in remaining memory with reduced group size (4–8 rollouts vs. TII's 16). Training runs take days to weeks on a single DGX Spark. On a cloud cluster (4–8× A100), the same runs complete in hours to days. The data never leaves the enterprise's infrastructure in either case.

### Consumer: LoRA Fine-Tuning

LoRA on attention layers with a quantized base model (~5GB VRAM). Cannot directly update Mamba-2 SSM parameters, but the attention layers learn to produce representations tuned to the consumer's environment — the SSM processes these using its framework-trained weights. Mamba's persistent state further accelerates adaptation — recurring patterns reinforce in state across sessions without explicit retraining.

## SFT Data Mix

Both tiers draw from the same three data categories:

1. **Reasoning traces** — Step-by-step tool-call trajectories distilled from frontier agents (Claude Code, Gemini CLI). The model learns tool-call format, decision patterns, and `<think>` reasoning structure.

2. **State transition pairs (Dreamer training)** — Trajectory replay data synthesized from the hypergraph memory. Each pair is `(Context + Tool Call) → (Real Tool Output)`, formatted with the State Transition Prompt as the system message. This teaches the Dreamer capability — how `ls -la` behaves, how a compiler returns errors, how `write_file` changes directory state, how `bun test` reports failures. No new infrastructure required — the hypergraph already captures every tool call and its result as JSON-LD decision files (see `HYPERGRAPH-MEMORY.md`).

3. **Deployment usage + user feedback** — Real-world trajectories and user preference signals. Successful trajectories become SFT data; failed + corrected trajectories become GRPO preference pairs.

The model learns to switch behavior based on prompt context — reasoning prompt produces `<think>` + tool calls, State Transition Prompt produces state-change predictions, Reward Prompt produces progress scores — the same way Falcon-H1R already switches between reasoning and tool-calling modes.

## Training Data from the Hypergraph

The hypergraph memory (see `HYPERGRAPH-MEMORY.md`) is the richest training signal — it captures not just what the agent did (tool calls and outputs), but the full BP decision state at each step (what was blocked, interrupted, and why). Trajectories are slices of the JSON-LD decision history.

```
JSON-LD decision files (by project, time range, outcome)
  → Filter: successful task trajectories → SFT data
  → Filter: failed tasks + corrections → GRPO preference pairs
  → Filter: recurring blocking patterns → bThread candidates → Owner approval
```

Training data extraction is a query over the hypergraph, not a separate export pipeline.

### Log Retention for Training

The hypergraph is append-only. It grows forever. The fix is **rotation** — moving old decision files into compressed archives. No data loss, no merging, no summarization.

```
Old JSON-LD files → archive to .jsonl.gz per project partition
  → compressed files available for replay or training
```

| Tier | Storage | Purpose |
|---|---|---|
| **Hot** | JSON-LD files in git | Recent decisions — active plans, current session, configurable window |
| **Archive** | `.jsonl.gz` files (outside workspace) | Rotated decisions — replayable for training extraction or plan rebuilds |
| **Training artifacts** | Extracted before rotation | SFT trajectories, GRPO preference pairs — kept as separate files |

**What triggers rotation:** Time-based (daily/weekly), size-based (per-project partition exceeds threshold), or user-triggered. The framework provides the mechanism; the deployment decides the schedule.

## The Flywheel

Usage → trajectories → SFT/GRPO → better model → better usage → more trajectories. Recurring patterns crystallize into explicit bThreads, growing the symbolic layer monotonically. The neural layer gets smarter; the symbolic layer gets stricter. Both improve together.

**bThread approval:** When the flywheel proposes a new bThread (crystallized from recurring patterns), the owner must explicitly approve it before it's added to the constraint engine. The symbolic layer never grows without human consent.

## Cross-Project Training

Project subprocesses have hard process boundaries (see `PROJECT-ISOLATION.md`). Patterns learned in one project are valuable in another. The resolution: **the model is the cross-project knowledge channel.**

The training pipeline operates above the isolation boundary. It reads decision files from all project partitions (with user consent), extracts trajectories, and trains the model. Updated weights carry generalized patterns into every project.

```
Project A decisions  ──┐
                       ├──→ Training pipeline (reads all partitions)
Project B decisions  ──┘        │
                                ↓
                       Updated model weights
                                │
                       ┌────────┴────────┐
                       ↓                 ↓
                 Project A            Project B
              (subprocess)         (subprocess)
            sees improved model   sees improved model
```

No subprocess reads another's memory. Knowledge transfer happens through weights, not data sharing.
