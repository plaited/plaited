# Slice 16

## Target

Refine the lower-scale prompt-derivation scripts using handpicked approved
seeds so they can generate stronger `S1-S3` precursor prompts from the final
regenerated HyperCard seed set.

## Scope

- `scripts/derive-modnet-prompts.ts`
- `scripts/modnet-prompt-derivation-evaluate.ts`
- `scripts/modnet-prompt-derivation-judge.ts`
- `scripts/modnet-prompt-derivation-meta-verifier.ts`
- `scripts/tests/modnet-prompt-derivation-evaluate.spec.ts`
- `scripts/tests/modnet-prompt-derivation-judge.spec.ts`
- `scripts/tests/modnet-prompt-derivation-meta-verifier.spec.ts`
- `dev-research/modnet/catalog/`
- `dev-research/modnet/`

## Required

- use handpicked strong prompts as the refinement/control set, drawn from:
  - handcrafted prompts
  - approved regenerated HyperCard seed candidates
- refine derivation behavior for `S1-S3` precursor generation rather than
  inventing unrelated prompts
- improve the derivation lane so lower-scale prompts preserve:
  - family fit
  - precursor plausibility
  - modnet-native boundedness
  - non-generic wording
- keep the output evaluable by the existing derivation judge/meta-verifier lane

## Preserve

- handcrafted prompts remain control/style anchors, not the full target space
- derived prompts should be real precursors to the approved higher-scale seed
- lower-scale prompts should stay bounded and reusable

## Avoid

- generic filler prompts that could come from any seed
- deriving lower-scale prompts that no longer resemble the seed family
- collapsing all families into one template

## Acceptance Criteria

- the derivation scripts produce better `S1-S3` precursor prompts from approved
  seeds
- the derivation judge/meta-verifier lane can clearly distinguish useful
  precursors from generic derivations
- the slice is concrete enough to run over the approved regenerated seed set
