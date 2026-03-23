# Modnet Prompt Catalog

This directory holds the canonical prompt source for modnet-native task
definition.

Current primary file:
- [modnet-training-prompts.jsonl](/Users/eirby/Workspace/plaited/dev-research/modnet/catalog/modnet-training-prompts.jsonl)
- [modnet-prompt-target-rubric.md](/Users/eirby/Workspace/plaited/dev-research/modnet/references/modnet-prompt-target-rubric.md)
- `modnet-raw-card-corpus.jsonl`
- `modnet-retained-raw-card-corpus.jsonl`

## Raw-Card Base 1 Gate

Slice 12 adds a compact Base 1 gate for historical catalog rows. It is
intentionally narrow:

- input fields: `id`, `title`, `description`
- output fields:
  - `inclusionDecision`
  - `modernAnalog`
  - `coreUserJob`
  - `whyRelevant`
  - `likelyPatternFamily`
  - `likelyStructure`
  - `searchQuerySeed`

The Base 1 validation flow is explicitly split into four stages:

1. deterministic prefilter
2. Codex inclusion/corollary generation
3. Sonnet judgment
4. Haiku meta-verification

The retained raw corpus is the compact handoff for Slice 13. It keeps the raw
card trio plus the accepted Base 1 corollaries and excludes archive URLs and
other enrichment.

## Current Shape

The catalog mixes:
- handcrafted ontology-teaching prompts
- HyperCard-derived breadth prompts

The current distribution is useful for Stage 1, but it is intentionally not
the same thing as:
- a retained training corpus
- a judged output corpus
- a native-model eval run

Those belong in `dev-research/native-model/` after generation, judging, and
curation.

The handcrafted prompts should also be treated as a control set rather than the
whole target space. For later raw-card regeneration and promotion decisions,
use the reusable rubric above instead of copying handcrafted prompt wording.

## Current Expansion Tracks

The active prompt-shaping strategy now has three linked tracks:

1. Derive `S1-S3` prompts from existing higher-scale prompts.
   - Many `S5/S6` prompts imply lower-scale precursor objects, lists, and
     blocks.
   - These low-scale prompts strengthen Stage 1 symbolic-output quality.

2. Add resource/capacity/orchestration prompts.
   - Nodes are sovereign but resource-bounded.
   - Popular service modules create real migration, pricing, and provisioning
     questions that the model should reason through.

3. Add participation-scale prompts.
   - A local module can remain structurally `S3/S4` while participating in an
     `S6+` ephemeral or aggregated network.
   - The prompt set should teach that distinction explicitly rather than
     collapsing intrinsic scale and network participation.

## Scale Interpretation

The catalog now distinguishes two different ideas when needed:

- intrinsic/local scale
  - what the module structurally is inside its own node
- participation scale
  - what larger market, household, team, or ephemeral network it joins

This matters because some prompts that first looked like `S5/S6` are better
modeled as:
- local `S4` collaborative surfaces
- that participate in `S5/S6` contexts when connected through PM and A2A

## Derivation Script

For future expansion, use:
- [derive-modnet-prompts.ts](/Users/eirby/Workspace/plaited/scripts/derive-modnet-prompts.ts)

This script generates candidate low-scale prompt expansions from higher-scale
seeds. Its output is advisory and should be reviewed before being promoted into
the canonical JSONL.

To evaluate derived prompt candidates with deterministic gating plus LLM judge
and meta-verification, use:
- [modnet-prompt-derivation-evaluate.ts](/Users/eirby/Workspace/plaited/scripts/modnet-prompt-derivation-evaluate.ts)
- [modnet-prompt-derivation-judge.ts](/Users/eirby/Workspace/plaited/scripts/modnet-prompt-derivation-judge.ts)
- [modnet-prompt-derivation-meta-verifier.ts](/Users/eirby/Workspace/plaited/scripts/modnet-prompt-derivation-meta-verifier.ts)

Example:

```bash
bun scripts/derive-modnet-prompts.ts --limit 20 > /tmp/modnet-derived-prompts.json
bun scripts/modnet-prompt-derivation-evaluate.ts \
  --candidates /tmp/modnet-derived-prompts.json \
  --output /tmp/modnet-derived-prompt-evals.jsonl
```
