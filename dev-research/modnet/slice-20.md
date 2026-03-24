# Slice 20

## Target

Improve the new `MiniMax M2.5`-based regeneration planner so it can reliably:

- rewrite a better initial modernization search query
- decide whether follow-up search is needed
- decide whether livecrawl is needed
- shape the final bounded prompt draft fields

This slice should use bounded autoresearch to improve the planner prompt and
the supporting generation code before the next full Slice 14 regeneration run.

## Scope

- `scripts/modnet-generate-raw-card-regeneration-candidates.ts`
- `scripts/modnet-raw-card-regeneration-base.ts`
- `scripts/structured-llm-query.ts`
- `scripts/tests/modnet-generate-raw-card-regeneration-candidates.spec.ts`
- `dev-research/modnet/`

## Required

- treat `minimax/minimax-m2.5` as the chosen cheap planner candidate
- optimize for modernization/search planning, not final seed judging
- keep the current raw-card inclusion judge stack unchanged:
  - `glm-5`
  - `minimax/minimax-m2.5`
- use a bounded retained-row sample for planner improvement:
  - `5-10` trusted rows with varied pattern families
- improve the planner prompt so it explicitly:
  - explains HyperCard as a historical 1980s/1990s Macintosh stack platform
  - treats the retained row as the source of truth
  - preserves the durable job while modernizing the medium/workflow
  - avoids nostalgia/history queries
  - avoids generic SaaS/product-suite inflation
  - prefers present-day bounded module/workflow search terms
- require explicit planner provenance in output metadata:
  - `plannerModel`
  - `plannerInitialUsed`
  - `plannerRefinementUsed`
  - `plannerFinalPromptUsed`
  - `plannerFallbackReason`
- make it easy to tell whether the planner:
  - changed the initial search query
  - changed the follow-up query
  - authored the final prompt draft
  - or fell back to the heuristic path
- improve fallback rules only after planner provenance is visible
- keep resume support intact

## Preserve

- `--variant` filtering
- `--resume` default behavior
- You.com search + conditional follow-up + conditional livecrawl structure
- trusted vs iffy corpus separation

## Avoid

- jumping straight to a full-corpus planner run before the bounded planner
  sample is clearly better than heuristic fallback
- spending Codex credits per retained row
- replacing the final judge path with the cheap planner
- silently mixing planner-authored and heuristic-authored prompts without
  provenance

## Acceptance Criteria

- the planner prompt is materially improved for historical-software
  modernization
- bounded planner runs show visible planner-authored query changes
- planner provenance is explicit in output JSON
- fallback usage is measurable
- the slice ends with a clear decision on whether `M2.5` is ready to drive the
  next Slice 14 regeneration sample

## Deliverable

A stronger `MiniMax M2.5` planner prompt and generation path, plus a bounded
planner bakeoff report showing whether planner-authored search/query shaping is
good enough to replace the current heuristic modernization planner.
