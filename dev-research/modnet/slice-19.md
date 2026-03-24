# Slice 19

## Target

Replace the current heuristic Slice 14 regeneration planner with a cheap
model-guided search-and-modernization planner that uses You.com evidence plus a
fast OpenRouter model to shape:

- the initial search query
- the follow-up search query
- whether livecrawl is needed
- the bounded modernization description
- the final prompt draft fields

This slice should determine whether `mistralai/mistral-small-2603` or
`minimax/minimax-m2.5` is the better cheap planner for this role.

## Scope

- `scripts/modnet-generate-raw-card-regeneration-candidates.ts`
- `scripts/modnet-raw-card-regeneration-base.ts`
- `scripts/structured-llm-query.ts`
- `scripts/openrouter-adapter.ts`
- `scripts/tests/modnet-generate-raw-card-regeneration-candidates.spec.ts`
- `scripts/tests/modnet-raw-card-regeneration-evaluate.spec.ts`
- `dev-research/modnet/`
- `dev-research/modnet/catalog/`

## Required

- treat this as a planner-generation slice, not a final judge-selection slice
- keep the current raw-card inclusion judge stack unchanged:
  - `glm-5`
  - `minimax-m2.5`
- do not use Codex per retained row for full-corpus regeneration
- compare two cheap planner candidates only:
  - `mistralai/mistral-small-2603`
  - `minimax/minimax-m2.5`
- require both planners to operate over the same structured stages:
  - retained row + original `searchQuerySeed`
  - planner-proposed initial search query
  - first You.com search result summary
  - optional planner-proposed follow-up search query
  - optional livecrawl escalation
  - final bounded prompt draft fields
- make the planner return structured JSON, not prose
- require the planner output schema to include:
  - `credibleModernization`
  - `modernAnalog`
  - `coreUserJob`
  - `likelyStructure`
  - `initialSearchQuery`
  - `needsFollowUpSearch`
  - `followUpSearchQuery`
  - `needsLivecrawl`
  - `promptInput`
  - `promptHint`
  - `whyPlausible`
  - `restraintNotes`
- preserve the retained row as source of truth:
  - search may refine vocabulary and module shape
  - search must not replace the retained row's core job
- run a bounded bakeoff first:
  - trusted sample: `25`
  - iffy sample: `15`
- judge the planner outputs with the existing regeneration evaluation layer only
  as a first pass, then manually inspect disagreement-quality samples
- compare:
  - malformed output rate
  - follow-up search rate
  - livecrawl rate
  - recommendation rate
  - prompt-quality drift
  - runtime/cost

## Preserve

- obsolete-medium rescue when the durable workflow still survives
- one bounded module, not a broad suite
- sovereign/local-first shaping
- separation between:
  - trusted retained corpus
  - iffy/meta-rescue corpus

## Avoid

- spending Codex credits on bulk per-row prompt generation
- keeping the current purely heuristic planner if the cheap planner models are
  materially better
- broad model shopping outside the two selected cheap planners
- collapsing search and modernization into unstructured prose
- letting search results pull rows into generic SaaS or team-product framing

## Acceptance Criteria

- the generation script can run in planner mode with either:
  - `mistralai/mistral-small-2603`
  - `minimax/minimax-m2.5`
- planner output is schema-validated structured JSON
- the planner can shape both:
  - initial search query
  - follow-up search query
- the planner can decide whether livecrawl is needed
- a bounded trusted/iffy bakeoff completes for both planners
- the slice ends with a clear decision:
  - keep heuristic planner
  - adopt `mistral-small`
  - adopt `m2.5`

## Deliverable

A documented cheap-planner bakeoff result and a revised Slice 14 generation
path that can use the chosen planner model plus You.com search to build
modernized bounded prompt drafts more reliably than the current heuristic
pipeline.
