# Training And Improvement

> Status: architecture direction. This page documents the discovery-first
> improvement strategy, not an implemented autonomous training loop.

## Position

Plaited should improve its agent stack in two phases:

1. discover the symbolic architecture
2. compress stable recurring semantics into the neural layer later

The first phase comes before weight adaptation.

## Discovery First

The pre-training workflow is:

- parallel lane search over bounded module or harness objectives
- local promotion of the strongest attempts inside a lane
- bundle-level promotion across interacting lanes
- retention of trusted artifacts, snapshots, and judged repair traces

This is not primarily ES, SFT, or GRPO.

It is a search-and-selection workflow for discovering:

- default modules
- search and retrieval policy
- symbolic interfaces
- MSS mappings
- signal conventions
- verification and simulation habits
- composition rules between modules

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

- modules are the product outputs
- retained research traces are the learning substrate
- the executor model is the researcher
- the adapted model is the student

These roles should preferably stay within one model family even when they run
at different sizes or on different tiers, but they are conceptually different.

Model-family choices are deployment and research decisions, not framework
contracts. Local runs may use smaller or quantized variants, while stronger
server-backed runs may use larger variants without changing the harness
contract.

## Model A / Model B Direction

Plaited's two-model direction should be framed as an architectural direction
until source proves a complete implementation.

Model A is the search and context assembler. It should use actor-controlled
tools such as `plaited-context`, source search, git history, You.com research
adapters, and other approved web research adapters. It assembles evidence,
prunes noise, and emits structured context with provenance.

Model B is the code, simulation, and trajectory generator. It should operate in
bounded worktrees and produce candidate changes, simulations, or plans that can
be evaluated by tests, `tsc`, frontier exploration, eval graders, diff
summaries, and promotion gates.

The handoff between model A and model B is structured context, not authority.
Tool calls and side-effect intents still return to Plaited actors for policy
and execution.

## Training Later

Once the default module bundle is stable, later weight adaptation can teach
the model stable Plaited semantics so the harness does not need to resend the
same basic framework information every time.

Likely targets for later LoRA or adapter-style adaptation:

- stable Plaited concepts
- stable MSS semantics
- better recognition of when internal or external search is needed
- better query decomposition and retrieval habits
- prompt-to-module mappings
- simulation and verification habits
- expected symbolic output structure

This should not include volatile runtime state or unstable implementation
details.

## Practical Rule

Module research precedes model adaptation.

First discover the symbolic layer through bounded parallel search and
bundle-level promotion. Only then use accepted artifacts and structured traces
to train the neural layer against a stable target.
