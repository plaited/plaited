# Slice 8: Autonomous Improvement On Real Tasks

## Target

Begin Stage 3 by training and evaluating autonomous improvement behavior on
realistic module and modnet-adjacent tasks.

## Scope

- `dev-research/native-model/`
- `scripts/`
- `src/improve/` and orchestrator surfaces only if shared breadth/depth
  substrate changes are required
- no collapse of `dev-research/modnet/` into this slice

## Required

- use multiple-attempt or breadth/depth improvement loops as training/eval
  targets
- optimize toward realistic module or modnet-adjacent outcomes
- preserve safe compare/select/promote behavior
- keep PM/governance and no-promotion-on-regression logic explicit

## Preserve

- `modnet` remains a separate research lane
- autonomous improvement is still bounded by evaluation and promotion rules
- realistic tasks do not bypass governance or simulation gates

## Avoid

- treating autonomous improvement as framework-only benchmark play
- teaching free-push or ungoverned winner selection behavior
- replacing modnet sovereignty concerns with generic multi-agent hype

## Acceptance Criteria

- autonomous improvement is evaluated on realistic module/modnet-adjacent tasks
- compare/select/promote behavior remains explicit and safe
- the slice brings Stage 3 closer to product and UX outcomes rather than
  abstract internal correctness alone
