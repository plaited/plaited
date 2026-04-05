# Autoresearch Factories

## Goal

Define a factory family that lets a deployed Plaited node continually evaluate
and improve its harness without widening the minimal core.

The target is not one monolithic self-editing loop. The target is a bounded
factory layer that:

- observes repeated failures and improvement opportunities
- schedules eval-backed improvement work
- produces candidate artifacts for skills, factories, and later prompt packs
- validates and judges those candidates
- promotes only winners that survive explicit checks

## Why This Lane Exists

The repo already has key pieces of the substrate:

- [src/cli/eval/eval.ts](../../src/cli/eval/eval.ts) for repeated execution and
  retained trial results
- [src/cli/program-runner/program-runner.ts](../../src/cli/program-runner/program-runner.ts)
  for bounded fanout over candidate attempts
- behavioral snapshots and signals for runtime observation
- verification-oriented research under
  [dev-research/verification-factories/program.md](../verification-factories/program.md)
- harness search framing under
  [dev-research/agent-harness-research/program.md](../agent-harness-research/program.md)

What is missing is a dedicated runtime-owned policy layer for continual
improvement after deployment.

## Relationship To Other Lanes

This lane should compose with:

- [dev-research/skill-factories/program.md](../skill-factories/program.md)
- [dev-research/verification-factories/program.md](../verification-factories/program.md)
- [dev-research/memory-factories/program.md](../memory-factories/program.md)
- [dev-research/agent-harness-research/program.md](../agent-harness-research/program.md)

The intended split is:

- `skills-factory` owns skill discovery, selection, and activation
- target factories own their runtime behavior
- `verification-factory` owns correctness checks and promotion constraints
- `autoresearch-factory` owns continual eval, candidate generation triggers,
  and promotion orchestration

## Product Target

The first shipped autoresearch factory bundle should support:

1. observing repeated failures from eval, snapshots, and verifier outputs
2. queueing bounded improvement jobs against an explicit target surface
3. invoking `src/cli/autoresearch` or equivalent bounded improvement runners
4. writing durable reviewable artifacts under a repo-local hidden directory
5. recording promotion decisions as explicit state
6. activating only validated overlays, not silent in-place rewrites

## Initial Target Surfaces

The first concrete target surfaces should be:

- `skill`
- `factory`

Later target surfaces may include:

- `prompt-pack`
- `search-policy`
- `verification-policy`

## Artifact Direction

The first durable storage target should be:

- `.plaited/autoresearch/`

Each run should emit reviewable artifacts such as:

- `run.json`
- `baseline.jsonl`
- `observations.jsonl`
- `candidates.jsonl`
- `promotion.json`

## Core Hypothesis

Plaited should support deployed nodes that improve through bounded judged
artifact search before any weight-level adaptation.

That means:

- eval remains a reusable primitive
- autoresearch becomes the orchestration layer around eval
- target-specific mutation logic stays behind explicit target handlers
- promotion remains reviewable and policy-bound

## First Implementation Slice

The first code slice should provide:

- `src/cli/autoresearch/` as the reusable CLI and library surface
- `src/factories/autoresearch-factory/` as the runtime policy seam
- minimal target handlers for `skill` and `factory`
- candidate artifact creation before autonomous activation
