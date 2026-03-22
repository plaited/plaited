# Modnet Prompt Catalog

This directory holds the canonical prompt source for modnet-native task
definition.

Current primary file:
- [modnet-training-prompts.jsonl](/Users/eirby/Workspace/plaited/dev-research/modnet/catalog/modnet-training-prompts.jsonl)

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
