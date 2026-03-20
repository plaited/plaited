# Skills Research Program

## Mission

Improve Plaited's skill tooling so skills trigger reliably, produce better
outputs, and remain aligned with the AgentSkills specification.

This lane is not runtime taxonomy work and is not native-model distillation.
It is about the operational layer in `skills/` and the framework tooling that
discovers, validates, evaluates, and improves those skills.

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

Plaited's skills should remain portable AgentSkills-compatible artifacts while
also benefiting from Plaited's stronger local tooling.

Therefore:
- skill validation should stay structural and lightweight
- skill evaluation should become first-class and behavioral
- descriptions should be tuned for activation quality, not only schema validity
- repeated operational work should move into `scripts/` only when evidence shows
  it is reused across runs

## Target Outcomes

This lane should improve:

- skill discovery catalogs
- description trigger quality
- structural validation
- behavioral evaluation
- script/references/assets hygiene
- trial/autoresearch support for skill iteration

## Architectural Rules

- Keep the progressive-disclosure model:
  - catalog first
  - full `SKILL.md` on activation
  - scripts/references/assets loaded on demand
- Do not collapse skills into modules.
- Keep skills AgentSkills-aligned and portable.
- Put shared runtime/tooling substrate in `src/`, not in skill-local scripts.

## Validation Split

This program distinguishes:

- **Validation**
  - structural checks
  - frontmatter and directory conventions
  - missing files and weak paths
- **Evaluation**
  - trigger accuracy
  - output quality
  - execution transcripts
  - reviewer and assertion feedback

Do not pretend validation alone is sufficient evidence of skill quality.

## Initial Slice Progression

- Slice 1: split structural validation from behavioral evaluation

## Acceptance Criteria

A retained change in this lane should:

- improve skill quality without making skills less portable
- preserve AgentSkills-compatible layout and progressive disclosure
- keep `src/` as the home for shared tooling
- avoid over-constraining skill instructions when eval evidence suggests
  simpler guidance would generalize better

## Safety

Do not let skill iteration introduce:
- hidden runtime dependencies
- cross-skill code ownership confusion
- evaluation loops that optimize only for passing narrow prompts
