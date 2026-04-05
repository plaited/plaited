# Agent Harness Research

## Position

Plaited should improve its agent stack in two phases:

1. discover the symbolic architecture
2. compress stable recurring semantics into the neural layer later

The first phase comes before weight adaptation.

## Discovery First

The pre-training workflow is:

- parallel lane search over bounded factory or harness objectives
- local promotion of the strongest attempts inside a lane
- bundle-level promotion across interacting lanes
- retention of trusted artifacts, snapshots, and judged repair traces

This is not primarily ES, SFT, or GRPO.

It is a search-and-selection workflow for discovering:

- default factories
- search and retrieval policy
- symbolic interfaces
- MSS mappings
- signal conventions
- verification and simulation habits
- composition rules between factories

## Why The Behavioral Runtime Matters

Plaited's behavioral runtime is part of the data strategy, not only the runtime
strategy.

Important properties:

- signals act as shared context
- signal-driven orchestration is observable
- `useSnapshot` exposes structured runtime moments
- `SnapshotMessageSchema` captures selection snapshots and important engine
  errors

Because the runtime already records structured behavioral moments, later
distillation can prefer:

- snapshot-derived traces
- accepted artifacts
- judged comparisons
- repair transitions

instead of relying on raw transcript dumps.

## Mental Model

The clean mental model is:

- factories are the product outputs
- retained research traces are the learning substrate
- the executor model is the researcher
- the adapted model is the student

These roles should preferably stay within one model family even when they run
at different sizes or on different tiers, but they are conceptually different.

The current starting assumption is that Gemma 4 is the first autoresearch
model family. Local runs may use smaller or quantized variants, while stronger
server-backed runs may use larger variants without changing the harness
contract.

## Training Later

Once the default factory bundle is stable, later weight adaptation can teach
the model stable Plaited semantics so the harness does not need to resend the
same basic framework information every time.

Likely targets for later LoRA or adapter-style adaptation:

- stable Plaited concepts
- stable MSS semantics
- better recognition of when internal or external search is needed
- better query decomposition and retrieval habits
- prompt-to-factory mappings
- prompt-to-module mappings
- simulation and verification habits
- expected symbolic output structure

This should not include volatile runtime state or unstable implementation
details.

## Practical Rule

Factory research precedes model adaptation.

First discover the symbolic layer through bounded parallel search and
bundle-level promotion. Only then use accepted artifacts and structured traces
to train the neural layer against a stable target.
