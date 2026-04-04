# Agent Harness Research

## Purpose

This program defines a long-horizon research lane for improving a Plaited node
by evolving its harness before adapting its model weights.

The goal is not to begin with ES, SFT, GRPO, or broad weight-level
optimization. The goal is to:

- stabilize the default factory bundle
- evolve harness behavior through bounded lane-local search
- use worktree-backed parallel attempts plus judged promotion
- retain structured traces, accepted artifacts, and repair evidence
- use those retained artifacts later for weight adaptation only after the
  symbolic architecture is stable

This lane is a workflow spec for search, promotion, and later model
adaptation. It is not a claim that the first optimization target should be the
model weights.

## Core Position

Small and medium local models fail more often from weak harness design than
from lack of raw weights alone.

The first optimization targets should therefore be:

- default factory design
- search and retrieval orchestration
- tool policy
- planning and decomposition policy
- verification and simulation policy
- memory formatting and retrieval rules
- signal and shared-context shaping
- behavioral orchestration patterns

Only after those surfaces are stable should recurring semantics be compressed
into the neural layer through LoRA, adapters, or other lightweight weight
adaptation.

## What This Lane Is And Is Not

This lane is:

- harness search
- symbolic architecture search
- behavioral-policy search
- structured trace retention
- later model-adaptation preparation

This lane is not primarily:

- ES over model weights
- SFT over a fixed hand-labeled corpus
- GRPO over a stable reward loop

Those methods may become useful later, but they are downstream of this lane.

## Research Substrate

The current repo already has the right substrate for this work:

- [src/improve](../../src/improve) for repeated evals, factory-program fanout,
  and retained run artifacts
- `dev-research/*/program.md` files for bounded mutation surfaces
- worktree-backed parallel attempts for durable fanout
- behavioral snapshots for structured runtime traces
- signals as shared context instead of generic mutable app state

This lane should assume the research workflow is:

1. define a bounded lane objective
2. run multiple in-scope attempts in parallel
3. validate and judge the survivors
4. promote local winners
5. run bundle-level composition checks where needed
6. retain only trusted artifacts and traces for later weight adaptation

## Why Snapshots And Signals Matter

Plaited's runtime is unusually valuable as a future data source because the
behavioral layer already exposes structured observable moments.

Relevant surfaces include:

- [src/behavioral/behavioral.schemas.ts](../../src/behavioral/behavioral.schemas.ts)
- `SnapshotMessageSchema`
- selection snapshots
- feedback errors
- restricted trigger errors
- b-thread warnings

Signals should be treated as shared context. When signal changes trigger
listeners and propagate through behavioral orchestration, the resulting
observable moments become part of the retained semantic trace.

That means this lane should prefer:

- structured snapshots over raw chat transcripts
- retained signal/context transitions over opaque hidden state
- analyzable handler and listener relationships over prompt-only behavior

## Parallel Lane Search

The default local search model for this lane is:

- one bounded lane objective
- multiple independent agent instances or workers
- each worker makes bounded attempts
- local winners are compared inside the lane
- bundle-level composition decides whether those winners survive integration

This is best understood as:

- parallel lane search with bundle-level promotion

Local winners are not automatically promotable. A lane winner may still fail
bundle-level composition.

## What Evolves First

The main evolving surface is the harness, not a standalone model-training job.

Examples:

- prompts and prompt-pack structure
- factory/module generation policy
- internal and external search routing
- search-result compression and citation policy
- MSS interpretation rules
- tool-choice policy
- simulation and verification policy
- decomposition and retry strategy
- signal naming and shared-context conventions
- memory formatting
- symbolic behavioral thread bundles

## What Evolves Later

Once the default factories and core symbolic contracts are stable, later work
may adapt the neural layer to internalize recurring Plaited semantics.

Good candidates for later weight adaptation include:

- stable Plaited framework concepts
- stable MSS semantics
- recurring prompt-to-module or prompt-to-factory mappings
- better recognition of when search is needed
- better query decomposition and search invocation habits
- better use of search results to drive module and factory selection
- recurring simulation and verification habits
- recurring output formats and symbolic conventions

Bad candidates for later weight adaptation include:

- rapidly changing implementation details
- current workspace state
- current signal values
- unstable factory bundles
- raw unverified trajectories

## Relationship To Training

Accepted artifacts should do two jobs:

1. become the shipped or candidate default symbolic artifacts
2. become trusted training assets later

That means:

- promoted default factories are product outputs
- retained judged traces are future learning substrate

The search loop and the training loop are related but distinct.

Search loop:

- generate candidates
- validate
- judge
- promote or reject

Later training loop:

- extract structured examples from accepted artifacts and trusted snapshots
- adapt weights with LoRA, adapters, or other lightweight methods
- re-evaluate against the same harness and bundle-level tasks

## Retained Training Bundle

Once the default factories are stable, this lane should define a retained
training bundle for later weight adaptation.

That bundle should prefer trusted structured artifacts over raw trajectories.

Expected bundle components:

- accepted factory and module artifacts
- verified MSS boundary decisions
- verified prompt-to-module and prompt-to-factory mappings
- search-policy and retrieval-policy examples
- simulation traces
- verification reports
- failed-versus-repaired attempt pairs
- judged promotion comparisons
- snapshot-derived signal and orchestration traces that are stable enough for
  reuse

This bundle should be explicitly downstream of verification and promotion, not
assembled from raw unverified attempt logs.

## Catalog Role

The prompt buckets under [dev-research/agent-harness-research/catalog/](catalog) should
be treated as part of the intent distribution for later evaluation and model
adaptation.

They are especially useful once the default factory bundle exists and the
question becomes:

- can the model infer the right MSS or Plaited structure from user intent?
- can it choose the right module, card, panel, or factory family?
- can it decide when internal or external search is needed?
- can it do so with less repeated framework instruction?

## Operational Rules

- use durable worktree-backed or equally durable attempt directories
- never rely on opaque in-memory fanout alone
- preserve failed attempts for analysis
- preserve trusted snapshots and judge outputs for later extraction
- separate harness search from weight adaptation in analysis
- promote only after validation and judged comparison
- treat bundle-level compatibility as first-class

## Deliverables

Over time, this lane should produce:

- better default factory candidates
- bundle-level promotion evidence
- curated snapshot-derived trace assets
- repair and correction corpora
- intent-to-structure datasets grounded in trusted artifacts
- search-policy and retrieval-policy datasets grounded in trusted artifacts
- MSS-boundary and verification-derived datasets grounded in trusted artifacts
- later LoRA or adapter training inputs once the symbolic layer is stable
