# Slice 6

## Target

Refine `plaited evaluate-skill` so it works well with the Codex adapter as the
primary local skill-evaluation operator.

This slice is about the operational runtime/tooling seam around skill
evaluation, not broad skill-authoring guidance and not native-model training.

## Scope

- `src/tools/skill-evaluate.ts`
- `src/tools/tests/skill-evaluate.spec.ts`
- `src/cli.ts`
- `README.md`
- minimal adapter or script changes only if strictly required to make Codex
  skill evaluation realistic and reproducible

## Required

- make the with-skill run and without-skill baseline comparison reliable for
  Codex-mediated runs
- preserve the split between:
  - durable skill eval artifacts in `skills/<skill>/evals/`
  - ephemeral isolation in `.worktrees/`
- keep latest-report pointers stable inside the skill's `evals/` surface
- keep git history as the longitudinal record of accepted eval updates
- make the review output useful for a human operator deciding whether the skill
  is improving

## Preserve

- `validate-skill` remains structural only
- `evaluate-skill` remains the behavioral primitive
- skill-local eval artifacts remain the source of truth for prompts/rubric
- `.worktrees/` remains the place for ephemeral baseline/isolation worktrees
- the skills lane stays distinct from native-model and broad runtime taxonomy

## Avoid

- turning `evaluate-skill` into a full multi-skill orchestrator
- introducing a separate global results bucket outside skill-local `evals/`
- coupling the tool to one provider-specific grader contract
- requiring worktrees for every trigger evaluation when they are not needed
- broad `program:run` changes in this slice

## Acceptance Criteria

- Codex-oriented skill evaluation can be run repeatably against one skill
- with-skill vs without-skill comparison remains understandable and inspectable
- latest eval pointers are updated in the skill directory and tracked in git
- targeted validation passes

## Notes

This slice is the follow-up after introducing the first bounded
`plaited evaluate-skill` primitive. The goal is to improve its operational
quality with Codex before building a larger `program:run --lane skills`
orchestration layer above it.
