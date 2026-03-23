# Slice 13

## Target

Test search-grounded raw-card regeneration variants against the derived
prompt-target rubric and choose the cheapest reliable enrichment path.

## Scope

- `dev-research/modnet/catalog/modnet-training-prompts-handcrafted.jsonl`
- `dev-research/modnet/catalog/README.md`
- `.worktrees/hypercard-catalog-task/dev-research/native-model/hypercard-catalog.jsonl`
- `dev-research/modnet/`
- `skills/mss-vocabulary/SKILL.md`
- `skills/modnet-node/SKILL.md`
- `skills/modnet-modules/SKILL.md`
- `dev-research/modnet/references/modnet-native-model-training-guide.md`
- `scripts/modnet-raw-card-regeneration-base.ts`
- `scripts/modnet-raw-card-regeneration-compare.ts`
- `scripts/modnet-regeneration-variant-evaluate.ts`
- `scripts/tests/modnet-raw-card-regeneration-compare.spec.ts`
- `scripts/tests/modnet-regeneration-variant-evaluate.spec.ts`

## Required

- treat the retained raw corpus from Slice 12 as the only card input surface
- use the Slice 11 rubric as the target prompt profile
- compare exactly these flows:
  - `Base 1`
  - `Base 1 + Search`
  - `Base 1 + Search -> targeted follow-up search + conditional livecrawl`
- require search in both enriched variants
- do not use research lite in this slice
- make contents/livecrawl conditional rather than mandatory
- judge whether enrichment improves:
  - modern relevance
  - prompt quality relative to the handcrafted target profile
  - MSS plausibility
  - seed-worthiness usefulness

## Preserve

- handcrafted prompts act as control/style anchors, not a complete target space
- the first search should recover modern workflow vocabulary before any deeper
  retrieval step
- follow-up search/livecrawl should happen only when search snippets are not
  enough to recover the module shape

## Avoid

- fixed exemplar copying
- always escalating to livecrawl
- treating search popularity as the same thing as module relevance

## Acceptance Criteria

- a winner is chosen between the three flows above
- the winner is justified on quality/cost grounds
- the chosen flow is concrete enough to run across the retained corpus in the
  next slice
