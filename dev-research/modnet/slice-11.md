# Slice 11

## Target

Derive a compact reusable prompt-target rubric for modnet-native prompt
generation from the repo's skills, reference docs, and handcrafted prompt set.

## Scope

- `dev-research/modnet/catalog/modnet-training-prompts-handcrafted.jsonl`
- `skills/mss-vocabulary/SKILL.md`
- `skills/modnet-node/SKILL.md`
- `skills/modnet-modules/SKILL.md`
- `dev-research/modnet/references/modnet-native-model-training-guide.md`
- `dev-research/modnet/`

## Required

- infer what the handcrafted prompts are teaching about:
  - MSS expression
  - exposure framing
  - sovereign-node relevance
  - prompt style and level of specificity
  - seed-worthiness signals
- produce a reusable target rubric that can guide later raw-card regeneration
- abstract the pattern from the handcrafted set rather than merely restating
  individual prompts
- explicitly identify what should be avoided:
  - overfitting to one exemplar
  - nostalgia-faithful HyperCard recreation
  - obsolete technical details with no modern sovereign corollary
  - prompt leakage from fixed example wording

## Preserve

- the handcrafted set should act as a style/control set, not a complete world
  model
- do not treat the handcrafted prompts as the whole target space
- keep the rubric compact enough to reuse in later experiments

## Avoid

- generating raw HyperCard prompts in this slice
- adding new code when a research artifact is sufficient
- turning the rubric into a giant prose dump from skills/docs

## Acceptance Criteria

- a reusable target rubric exists for later prompt-regeneration experiments
- the rubric captures the desired modnet-native pattern without copying
  exemplar phrasing
- the rubric makes explicit how handcrafted prompts should be used as control
  examples rather than exhaustive coverage
