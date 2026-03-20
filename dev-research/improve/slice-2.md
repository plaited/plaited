# Slice 2: Trial-Oriented Judge and Meta-Verifier Boundary

## Target

Define and begin separating trial-oriented evaluation contracts from the
repo-improvement judge path so native-model and skill evaluation can use LLM
judge/meta-verifier logic without inheriting repo-autoresearch assumptions.

## Scope

- `src/improve.ts`
- `src/improve/`
- `scripts/claude-code-judge.ts`
- `scripts/claude-haiku-meta-verifier.ts`
- `scripts/tests/claude-code-judge.spec.ts`
- `scripts/tests/claude-haiku-meta-verifier.spec.ts`
- `dev-research/native-model/`

## Required

- make the difference between repo-improvement judging and trial-result judging
  explicit
- identify or define a trial-oriented judge input/output contract
- identify or define a trial-oriented meta-verifier input/output contract
- support retained-output suitability labeling needed by the native-model lane
- keep provider-specific implementations in `scripts/`

## Preserve

- provider-specific judge implementations remain outside `src/`
- current repo-improvement judging continues to work
- native-model and skill lanes can consume generic result/provenance types
- the improve lane remains the shared substrate rather than collapsing into
  native-model policy

## Avoid

- moving Claude-specific logic into shipped framework surfaces
- conflating code-diff judging with prompt/output trial judging
- requiring a full migration of all judge scripts in one slice
- baking native-model policy directly into provider-specific scripts

## Acceptance Criteria

- the code and docs distinguish repo-improvement judging from trial-oriented
  judging more explicitly
- a concrete trial-oriented judge/meta-verifier contract exists in code or docs
- retained-output suitability labels needed by native-model are represented
  clearly enough for later implementation
- the direction supports later reuse by:
  - skills evaluation
  - native-model validation
  - curated training-data selection

## Notes

This slice is about the boundary and contract first.
It does not need to deliver the full native-model collection pipeline in one
pass.
