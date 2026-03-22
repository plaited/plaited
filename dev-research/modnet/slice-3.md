# Slice 3

## Target

Define the receiving-node simulation and evaluation flow before imported modnet
artifacts are accepted, rejected, or replayed.

## Scope

- modnet research lane only
- receiving-node simulation flow
- PM-governed inspect/simulate/import/reject decisions
- no bypass of local constitution or boundary policy

## Required

- define the stages a receiving node should run before accepting an artifact
- include simulation or evaluation as a first-class gate where appropriate
- preserve PM authority over the final import decision
- keep the flow compatible with sovereign personal and enterprise nodes

## Preserve

- imported artifacts remain untrusted until evaluated
- simulation does not bypass constitution or promotion policy
- A2A stays the exchange boundary rather than becoming a hidden execution lane

## Avoid

- treating bundle receipt as implicit acceptance
- allowing simulation results to auto-apply changes without PM authority
- collapsing local node evaluation into a centralized network service

## Acceptance Criteria

- the receiving-node decision flow is explicit and staged
- simulation/evaluation is represented as a real gate rather than an optional
  footnote
- PM remains the authority over import/apply decisions
