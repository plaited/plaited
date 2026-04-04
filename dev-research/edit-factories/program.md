# Edit Factories

## Goal

Research the default editing-oriented factory bundle for the Plaited agent.

This lane should define how the agent:

- chooses edit strategy for a requested change
- applies bounded code or doc edits through explicit factory policy
- checks whether an edit is complete enough to hand to verification
- retains reviewable evidence of what changed and why

The point is not to hardcode a monolithic editor into the core. The point is
to make editing a well-scoped factory family that composes with planning,
search, and verification.

## Why This Lane Exists

The repo already has edit-relevant substrates:

- a minimal core event loop
- file and execution capabilities
- search and module-discovery lanes for locating the right surface
- verification and improve infrastructure for judging outcomes

What remains open is editing policy:

- when to patch versus regenerate
- how much context should be gathered before editing
- how edits should be grouped or staged
- how to detect partial completion before handing off to verification

Without this lane, the default agent risks treating all edits as one undifferentiated
"write files somehow" capability.

## Relationship To Other Lanes

This lane sits under:

- [dev-research/default-factories/program.md](../default-factories/program.md)

It should integrate with:

- [dev-research/plan-factories/program.md](../plan-factories/program.md)
- [dev-research/search-factories/program.md](../search-factories/program.md)
- [dev-research/module-discovery-factories/program.md](../module-discovery-factories/program.md)
- [dev-research/node-home-factories/program.md](../node-home-factories/program.md)
- [dev-research/verification-factories/program.md](../verification-factories/program.md)
- [dev-research/observability-factories/program.md](../observability-factories/program.md)

The intended split is:

- `edit-factories` owns edit strategy and edit-state policy
- `node-home-factories` owns persistence factory behavior:
  - when and how durable state changes happen
- `node-home-factories` owns promotion factory behavior:
  - export/import/handoff semantics
- `verification-factories` owns correctness checks
- `observability-factories` owns retained diff and artifact traces

## Dependency Order

1. [src/agent/create-agent.ts](../../src/agent/create-agent.ts) defines the minimal core boundary
2. [src/agent/agent.types.ts](../../src/agent/agent.types.ts) defines the factory contract
3. [dev-research/default-factories/program.md](../default-factories/program.md) defines the bundle question
4. [skills/code-patterns/SKILL.md](../../skills/code-patterns/SKILL.md) and [skills/typescript-lsp/SKILL.md](../../skills/typescript-lsp/SKILL.md)
   provide bounded editing and analysis guidance
5. this lane hill-climbs the editing slice and feeds winners back into the
   default-factories umbrella

## Core Hypothesis

The best default editing bundle will not come from one generic edit behavior.

Instead, edit policy should classify common edit shapes and route among them,
for example:

- targeted patch
- multi-file coordinated refactor
- generated draft followed by repair
- doc-only update

## Product Target

The first shipped editing factory bundle should support:

1. classifying the requested edit surface
2. gathering the minimum necessary context before writing
3. choosing a bounded editing strategy
4. producing explicit edit state such as:
   - proposed
   - applying
   - partial
   - ready_for_verification
   - needs_repair
5. retaining changed-file summaries and supporting evidence
6. handing results cleanly to verification and projection layers

## Required Architectural Properties

### 1. Editing Is Not Just File I/O

This lane should own policy for:

- selecting edit scope
- minimizing collateral change
- representing partial completion
- deciding whether to continue, replan, or verify

### 2. Edit Strategies Should Stay Distinguishable

Candidate designs should preserve differences between:

- single-file patching
- cross-file structural edits
- generated-first edits
- repair edits after failed verification

### 3. Edit State Must Be Observable

The default bundle should make it clear:

- what files were targeted
- what strategy was chosen
- whether the edit finished cleanly
- why further repair is required

### 4. Editing Must Compose With Search And Verification

The editing layer should not assume:

- search already found enough context
- verification can infer missing intent

Those handoffs should stay explicit.

## Research Questions

This lane should answer:

- what edit classifications matter most for the default bundle?
- when should the agent patch versus regenerate?
- how should partial edits be represented?
- what is the smallest retained artifact set that makes edits reviewable?
- how should edit policy differ for docs, code, config, and generated modules?

## Candidate Factory Hypotheses

### 1. Targeted Patch First

Hypothesis:

- most default editing value comes from making narrow patch application highly
  reliable before optimizing larger refactors

### 2. Repair Loop First

Hypothesis:

- the key missing capability is not first-pass editing but reliable routing
  from failed verification into bounded repair edits

### 3. Edit-Class Routing First

Hypothesis:

- explicit edit-class selection improves both task performance and operator
  clarity more than one universal editing strategy

## Deliverables

This lane should produce:

- candidate editing factory bundles
- eval tasks for single-file, multi-file, and repair edits
- retained edit traces and changed-file summaries
- a recommendation for how editing should participate in the default bundle
