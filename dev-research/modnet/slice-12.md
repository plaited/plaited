# Slice 12

## Target

Validate a raw-card inclusion gate over the worktree catalog JSONLs and use it
to produce a prompt-ready retained corpus based only on `id`, `title`, and
`description`.

## Scope

- `.worktrees/macrepo-catalog-task/dev-research/native-model/macrepo-catalog.jsonl`
- `.worktrees/hypercard-catalog-task/dev-research/native-model/hypercard-catalog.jsonl`
- `dev-research/modnet/catalog/modnet-training-prompts.jsonl`
- `dev-research/modnet/`

## Required

- define a Base 1 relevance gate that reads only:
  - `id`
  - `title`
  - `description`
- Base 1 must output:
  - `retain | retain_low_priority | discard`
  - `modernAnalog`
  - `coreUserJob`
  - `whyRelevant`
  - `likelyPatternFamily`
  - `likelyStructure`
  - `searchQuerySeed`
- Codex should perform the primary inclusion/corollary generation
- Sonnet should judge whether the output is coherent and modnet-relevant
- Haiku should verify the Sonnet result for consistency and risk
- the experiment should explicitly test whether obsolete surfaces with durable
  modern analogs are retained correctly
- the accepted output of this slice is a retained raw corpus suitable for later
  search-grounded prompt regeneration

## Preserve

- ignore `source_url` for the initial inclusion gate
- use LLM judging as the primary evaluator, with deterministic checks only as
  guards
- keep the output compact enough to become a raw prompt-ready corpus for the
  next slice

## Avoid

- enriching with web search in this slice
- treating title/description-only judgments as final MSS classifications
- preserving obsolete implementation surfaces when the durable user job is weak
- promoting cards into the raw retained corpus just because they are historical
  curiosities

## Acceptance Criteria

- a clear Base 1 inclusion-gate contract exists and is testable
- a retained raw corpus can be produced from the two worktree JSONLs using only
  `id`, `title`, and `description`
- the validation plan clearly distinguishes:
  - deterministic prefiltering
  - Codex inclusion/corollary generation
  - Sonnet judgment
  - Haiku verification
