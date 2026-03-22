# Slice 2

## Target

Define the provenance and evaluation envelope that should travel with exchanged
modnet artifacts.

## Scope

- modnet research lane only
- exchanged artifact metadata
- evaluation summaries attached to exchanged artifacts
- no runtime implementation requirement in this slice

## Required

- define the minimum provenance attached to exchanged bundles/artifacts
- define how evaluation or simulation summaries travel with an artifact
- preserve PM authority over import/apply decisions
- keep the envelope compatible with sovereign-node exchange

## Preserve

- A2A remains the inter-node exchange boundary
- PM remains import/export/apply authority
- exchanged artifacts are not trusted by default

## Avoid

- skipping provenance because git history exists somewhere else
- assuming raw bundles are enough without evaluation metadata
- collapsing import policy into transport details

## Acceptance Criteria

- provenance requirements are explicit
- evaluation summary requirements are explicit
- the design still preserves sovereign-node import authority
