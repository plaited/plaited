# Training: Distillation from Frontier Agents

> **Status: ACTIVE** — Design rationale document. Implementation details moved to `skills/training-pipeline/`. Cross-references: `AGENT-LOOP.md` (pipeline context), `HYPERGRAPH-MEMORY.md` (JSON-LD as training source), `CONSTITUTION.md` (flywheel bThread approval).

## Overview

The framework ships with base-trained checkpoints for generative UI and general-purpose coding tasks. New deployments start useful. Over time, real-world usage generates training data that improves the model through distillation.

## Why Distillation, Not a Pre-trained Tool-Calling Model

Pre-trained tool-calling models (GPT-4, Claude) are trained on generic tool schemas. Our model needs:

1. **Specific tool schemas** — our tools have specific argument shapes and output formats
2. **BP-aware reasoning** — the model needs to understand that blocked actions should be re-planned, not retried
3. **Dreamer capability** — predicting state transitions requires training on `(Context + Tool Call) -> (Real Output)` pairs from our specific tools
4. **Constitution awareness** — the model learns governance constraints through context assembly + experience, not generic instruction-following

Distillation from frontier agents (Claude Code, Gemini CLI) via the trial runner provides the reasoning patterns. Fine-tuning on our specific tools and BP feedback loop produces a model that's both capable and constraint-aware. See `AGENT-LOOP.md` (overview) and `skills/agent-loop/` (implementation patterns).

## The Flywheel

Usage -> trajectories -> SFT/GRPO -> better model -> better usage -> more trajectories. Recurring patterns crystallize into explicit bThreads, growing the symbolic layer monotonically. The neural layer gets smarter; the symbolic layer gets stricter. Both improve together.

**bThread approval:** When the flywheel proposes a new bThread (crystallized from recurring patterns), the owner must explicitly approve it before it's added to the constraint engine. The symbolic layer never grows without human consent.

## Implementation

For pipeline design, data formats, training tiers, distillation stages, and cross-project knowledge transfer, see the [`training-pipeline` skill](../skills/training-pipeline/SKILL.md).
