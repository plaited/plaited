# Slice 1: Validation vs Evaluation Split

## Target

Create the first bounded skill-quality lane by separating structural skill
validation from behavioral skill evaluation.

This slice should establish the basic framework for evaluating skills without
forcing that work into the runtime-taxonomy lane.

## Scope

- `src/tools/skill-validate.ts`
- `src/tools/skill-discovery.ts`
- `src/tools/skill.utils.ts`
- `src/tools/tests/skill-validate.spec.ts`
- `src/tools/tests/skill-discovery.spec.ts`
- `skills/validate-skill/`

## Required

- Keep `validate-skill` focused on structural/spec checks.
- Add the first explicit skill-evaluation surface rather than overloading
  validation.
- Make the split visible in framework tooling, naming, or docs.
- Preserve progressive disclosure and AgentSkills-compatible layout.
- Keep eval artifacts and conventions local to skills where practical.

## Preserve

- progressive disclosure remains the skill loading model
- skills remain AgentSkills-compatible and portable
- shared tooling stays in `src/`, not in cross-skill runtime imports
- this lane remains separate from runtime-taxonomy work

## Acceptance Criteria

- Structural validation and behavioral evaluation are represented as distinct
  concepts in the code and docs.
- The implementation identifies a concrete initial surface for behavioral
  evaluation instead of leaving it purely conceptual.
- The implementation direction supports:
  - description trigger evaluation
  - output-quality evaluation
  - later reuse of trial/autoresearch infrastructure
- The work does not introduce cross-skill runtime coupling or collapse skill
  tooling into the runtime-taxonomy lane.

## Notes

This slice is about the tooling split, not a complete skill-eval system.
Keep the change bounded and foundational.
