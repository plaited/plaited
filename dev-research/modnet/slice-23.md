# Slice 23

## Target

Prepare the approved regenerated-seed context for the next lower-scale
derivation slice so Slice 16 can derive stronger `S1-S3` precursor prompts from
classified Slice 15 seed candidates.

The next slice should derive from the rewritten Slice 14 / Slice 15 seed, not
from the raw HyperCard row alone. But the original HyperCard source still needs
to remain present as grounding evidence so lower-scale derivation does not
drift.

This slice should improve the carried-forward context used by the derivation
lane before any large fanout generation over approved seeds.

## Approved Exemplar Seeds

Use these already approved sample seeds as grounding examples for the carried
context shape:

- `hypercard_archimedes-discovering-pi`
  - approved as `creative-tool`, `S1`
- `hypercard_klingondictionary`
  - approved as `reference-browser`, `S2`
- `hypercard_1st-law-of-thermodynamics`
  - approved as `educational-interactive`, `S3`

These should help calibrate what the derivation lane needs for:
- compact but reusable `S1`
- bounded navigable `S2`
- richer but still grounded `S3`

## Scope

- `scripts/derive-modnet-prompts.ts`
- `scripts/modnet-prompt-derivation-evaluate.ts`
- `scripts/modnet-prompt-derivation-judge.ts`
- `scripts/modnet-prompt-derivation-meta-verifier.ts`
- `scripts/tests/`
- `dev-research/modnet/`

## Required

- treat the rewritten seed as the primary derivation source:
  - regenerated modern title
  - regenerated prompt input
  - regenerated prompt hint
  - final reclassified pattern family
  - final reclassified MSS scale/structure
- preserve the original HyperCard row as grounding evidence:
  - source title
  - source description
  - source user-job / relevance anchors when available
- make the derivation lane understand that:
  - lower-scale prompts should be real precursors to the approved seed
  - lower-scale prompts should preserve family fit and boundedness
  - lower-scale prompts should not flatten into generic template filler
- improve the derivation judge/meta prompts so they explicitly value:
  - precursor plausibility
  - family continuity
  - scale continuity
  - usefulness as real building blocks

## Preserve

- Slice 16 remains a derivation lane, not a nostalgia recovery lane
- the approved seed remains the main parent artifact
- original HyperCard evidence remains as anti-drift grounding

## Avoid

- using only the original HyperCard title/description as the derivation source
- using only the regenerated prompt text without source grounding
- generic `S1-S3` prompts that could come from any seed
- family or scale drift during precursor generation

## Acceptance Criteria

- the derivation lane has a clearer carried-forward context model
- approved seeds can supply enough context for lower-scale precursor generation
- original source evidence remains available as grounding
- the slice ends with a better basis for large fanout generation in Slice 16
