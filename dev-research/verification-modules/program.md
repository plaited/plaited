# Verification Modules

## Goal

Research a module family that owns correctness-oriented verification for the
default Plaited agent.

This lane should define how the agent:

- simulates candidate actions before risky commitment
- verifies structural and behavioral constraints
- checks MSS-aware module and boundary correctness
- routes failed proposals into repair paths
- produces retained verification artifacts suitable for later model
  adaptation

The first shipped verification module should treat verification as a composed
module layer, not as scattered ad hoc checks.

## Why This Lane Exists

The repo already has pieces of the correctness story:

- schema validation
- bounded workspace authority
- repeated evals in [src/eval](../../src/eval)
- module-program validation in repo-native module-program runner CLI surface (removed)
- behavioral snapshots and observable traces
- MSS and boundary semantics through [skills/modnet-modules](../../skills/modnet-modules)

What is missing is one dedicated lane that owns the broader question:

- how do we decide that a proposed module, module, or action is correct
  enough to promote or execute?

This is larger than syntax or type correctness alone.

The missing work includes:

- structural verification
- behavioral verification
- MSS-aware boundary verification
- intent correctness checks
- simulation-driven triage
- repair after failed verification

Without this lane, correctness risks being partially owned by many programs and
fully owned by none.

## Relationship To Other Lanes

This lane is a focused subprogram under:

- [dev-research/server-module/program.md](../server-module/program.md)

It should integrate with:

- [dev-research/three-axis-modules/program.md](../three-axis-modules/program.md)
- [dev-research/module-discovery-modules/program.md](../module-discovery-modules/program.md)
- [dev-research/search-modules/program.md](../search-modules/program.md)
- [dev-research/skill-modules/program.md](../skill-modules/program.md)
- [dev-research/agent-harness-research/program.md](../agent-harness-research/program.md)

The intended split is:

- `verification-modules` owns explicit check, simulation, and repair policy
- `three-axis-modules` owns authority/autonomy/capability control
- `module-discovery-modules` owns module qualification and loading policy
- `search-modules` owns retrieval and evidence gathering

## Core Hypothesis

Correctness for Plaited is not only:

- schema validity
- type validity
- tool safety

It also includes semantic rightness relative to:

- user intent
- MSS structure
- declared module boundaries
- default module composition rules

The best default verification bundle should therefore combine deterministic
checks, simulation, and reviewable verification artifacts rather than relying
on one model pass alone.

## Verification Classes

### 1. Structural Verification

Examples:

- schema and export checks
- signal shape checks
- module contract checks
- module export validation

### 2. Behavioral Verification

Examples:

- invalid event or signal transitions
- blocked or contradictory orchestration behavior
- side-effect routing that violates expected behavioral coordination

### 3. MSS Boundary Verification

Examples:

- incorrect module granularity
- wrong boundary tag or category
- cross-boundary coupling that should be split
- semantically wrong module shape despite valid code

### 4. Intent Correctness

Examples:

- the generated module is structurally valid but mismatched to user intent
- the wrong card, panel, module family, or module type was chosen
- search evidence was present but used incorrectly

## Product Target

The first shipped verification module bundle should support:

1. running deterministic checks over candidate outputs
2. running simulation before risky commitment where useful
3. checking MSS-aware module and boundary semantics
4. emitting explicit runtime state for:
   - verified
   - unverified
   - failed
   - blocked
   - repaired
5. producing repair hints or repair prompts after failed verification
6. integrating with default-module promotion decisions

## Required Architectural Properties

### 1. Verification Is A Module Surface

This lane should avoid burying verification logic separately inside:

- search
- module discovery
- memory
- three-axis policy
- prompts alone

The verification layer should remain explicit and composable.

### 2. Verification Must Be Reviewable

Candidate designs should make it easy to inspect:

- what was checked
- which checks passed or failed
- what evidence was used
- what repair path was suggested
- what decision the verification result informed

### 3. Verification Should Be Pluggable

The default design should be compatible with:

- deterministic schema and contract checks
- behavioral assertions
- model-assisted judging
- simulation
- future solver-backed checks

### 4. MSS Semantics Must Be First-Class

This lane should explicitly account for correctness relative to:

- module boundaries
- boundary tags
- composition expectations
- modnet and MSS semantics

### 5. Verification Should Produce Training Assets

The lane should preserve artifacts that can later feed model adaptation, such
as:

- failed vs repaired examples
- simulation traces
- verified boundary decisions
- verification reports
- prompt-to-correct-structure mappings

## Research Questions

This lane should answer:

- what correctness classes can be checked deterministically today?
- which proposal failures require simulation instead of static checks?
- how should MSS boundary correctness be represented?
- what verification state should live in signals?
- how should failed verification route into repair attempts?
- which verification artifacts are reliable enough for a retained training
  corpus?

## Deliverables

This lane should produce:

- candidate verification module bundles
- eval tasks for correctness, repair, and simulation
- MSS-aware boundary verification criteria
- retained verification traces and reports
- integration notes for bundle-level promotion
