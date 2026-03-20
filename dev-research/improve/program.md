# Improvement Substrate Program

## Mission

Extract and refine the model-agnostic improvement substrate that should live in
the framework rather than in provider-specific developer scripts.

This lane is about the generic improvement protocol:
- bounded attempts
- worktree orchestration
- provenance and experiment records
- program/slice execution
- validation and decision flow

It is not about locking Plaited to Claude, Codex, or any single model vendor.

## Separation From Other Programs

- `dev-research/runtime-taxonomy/program.md`
  - local framework/runtime/autoresearch infrastructure
- `dev-research/skills/program.md`
  - skill discovery, validation, evaluation, and improvement workflows
- `dev-research/improve/program.md`
  - generic improvement substrate and model-agnostic improvement protocol
- `dev-research/native-model/program.md`
  - Falcon/native-model behavior and distillation
- `dev-research/modnet/program.md`
  - inter-node collaboration, exchange, and governance

Do not merge these concerns casually.

## Core Hypothesis

Some of the current dev autoresearch machinery is general enough to improve
outcomes across:
- framework slices
- skill evaluation
- module improvement
- native-model improvement

Therefore:
- provider-specific adapters and judges should remain external
- model-agnostic attempt orchestration and provenance should be extractable
- the framework should own the improvement protocol, not the model bindings

## What Belongs In This Lane

- generic attempt lifecycle
- isolated worktree orchestration
- keep / revise / discard flow
- scope and validation gating
- program/slice loading
- stage logs and experiment provenance
- reusable improvement records for later skill/module/native-model work

## What Does Not Belong In This Lane

- Claude-specific judge logic
- Codex-specific adapter logic
- provider SDK wrappers
- native-model distillation policy itself

Those remain separate until they can be expressed as generic interfaces.

## Architectural Rules

- Promote the improvement protocol, not the model bindings.
- Keep provider-specific adapters in `scripts/` or external packages.
- Only move code into `src/` if it is model-agnostic and broadly reusable.
- Preserve provenance and boundedness when extracting reusable pieces.

## Initial Slice Progression

- Slice 1: separate model-agnostic improvement orchestration from provider-specific adapters and judges

## Acceptance Criteria

A retained change in this lane should:

- reduce coupling between improvement infrastructure and specific model vendors
- preserve current bounded autoresearch behavior
- make later reuse by skills/modules/native-model lanes easier
- avoid prematurely promoting dev-only assumptions into shipped runtime surfaces

## Safety

Do not move provider-specific evaluation logic into the framework merely for
convenience. Keep the framework substrate general and the bindings replaceable.
