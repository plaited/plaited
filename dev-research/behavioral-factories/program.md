# Behavioral Factories

## Goal

Research and compile behavioral-factory patterns that let Plaited evolve a
capable personal agent on top of its stable symbolic foundations.

This lane is not just about compiling one-off factories from upstream seed and
corpus artifacts. It is the lane that should discover and refine the factory
architecture needed for:

- mutable policy and harness surfaces
- observable rollouts
- scoring and selection
- retained artifacts for reuse and distillation
- tool-first memory and retrieval

The stable runtime foundation is assumed to remain:

- `src/behavioral`
- `src/ui`
- most of `src/server`

Everything else is up for change if it better leverages those foundations.

## Dependency Order

1. `mss-seed` defines compact MSS anchors.
2. `mss-corpus` encodes MSS and Modnet evidence against those anchors.
3. `behavioral-seed` defines compact behavioral and constitution anchors.
4. `behavioral-corpus` encodes behavioral and governance evidence against those
   anchors.
5. `behavioral-factories` compiles and researches the factory architecture that
   uses those anchors and corpus artifacts to drive agent evolution.

This lane should consume upstream contracts. It should not recreate upstream
seed or corpus responsibilities.

## Purpose

The purpose of this lane is to determine what behavioral-factory patterns are
needed for an evolvable agent system.

That includes researching and refining:

- policy factories
- context factories
- memory factories
- rollout factories
- validation factories

These factories should make it possible for a model to internalize behavioral
programming, MSS, and the Plaited UI layer while still using tools, retrieval,
and symbolic coordination when needed.

## Inputs

Primary lane inputs:

- `dev-research/behavioral-factories/program.md`
- `dev-research/mss-seed/program.md`
- `dev-research/mss-seed/seed/`
- `dev-research/mss-corpus/program.md`
- `dev-research/mss-corpus/encoded/`
- `dev-research/behavioral-seed/program.md`
- `dev-research/behavioral-seed/seed/`
- `dev-research/behavioral-corpus/program.md`
- `dev-research/behavioral-corpus/encoded/`
- `dev-research/evolutionary-agent/program.md`
- `skills/behavioral-core/SKILL.md`
- `skills/constitution/SKILL.md`
- `skills/mss/SKILL.md`
- `src/behavioral/behavioral.ts`
- `src/ui/`
- `src/agent/factories.ts`
- `src/agent/governance.ts`
- `src/server/`

Supporting implementation and memory-shaping surfaces:

- `skills/hypergraph-memory/SKILL.md`
- Bun runtime docs and relevant local usage patterns for:
  - markdown
  - yaml
  - html rewriting
  - file IO
  - JSONL streaming
  - archive snapshots

## Input Priority

Use these inputs with clear precedence:

1. `src/behavioral`, `src/ui`, and stable `src/server` surfaces are the runtime
   foundation.
2. behavioral and MSS seed/corpus artifacts define the semantic and evidence
   layer the factories should consume.
3. skills are implementation and teaching surfaces, not the final runtime home
   of the system.
4. if a simpler markdown / yaml / jsonl / archive approach satisfies the lane
   goal better than a graph-heavy approach, prefer the simpler approach.

This lane must not assume that hypergraph persistence is mandatory.
Hypergraph-style artifacts are allowed, but only when they materially improve:

- retrieval
- provenance
- compositional reasoning
- stable symbolic anchors

## Memory Strategy

This lane should prefer a tool-first memory approach unless the work shows that
a heavier semantic substrate is necessary.

Primary memory substrates may include:

- markdown fragments
- yaml fragments
- html fragments or rewritten extracts
- JSONL traces
- git-backed context packs
- archive snapshots

Derived semantic artifacts may still exist, but they should serve retrieval,
validation, provenance, or training rather than becoming mandatory by default.

## What This Lane Should Discover

The lane should answer questions such as:

- what is the right unit of mutation for the agent package?
- which factory families are actually needed?
- how should context packs be built from files, traces, and source artifacts?
- when should the agent rely on symbolic context vs retrieval vs search?
- how should retained artifacts be summarized and reused?
- what deterministic validators best constrain generated behavioral code?

## Factory Families

The lane should explore and refine factory families such as:

### Policy Factories

- search policy
- retrieval invocation policy
- uncertainty and escalation policy
- critique and retry policy
- answer finalization policy

### Context Factories

- markdown pack builders
- yaml/jsonl state pack builders
- source-link expansion
- git-context pack builders
- archive snapshot builders

### Memory Factories

- write-memory decisions
- summarize-to-memory rules
- retrieval ranking and packing
- stale-memory pruning

### Rollout Factories

- task decomposition
- fanout strategy
- compare and merge strategy
- replay strategy

### Validation Factories

- behavioral anti-pattern guards
- TypeScript / LSP seam checks
- test-selection rules
- contract-shape validators

## External Retrieval

Primary evidence should come from the listed local inputs and lane-provisioned
skills. If those are insufficient, external retrieval may use targeted web
search via the provisioned You.com skill.

Use external retrieval only to:

- confirm missing runtime or compilation semantics
- verify terminology or implementation patterns not present locally
- compare bounded alternative approaches for memory, retrieval, or evaluation

Do not treat web search as the primary source of truth for this lane.
If external retrieval materially changes the result, record that in the run
summary.

## Writable Surface

Only write within:

- `dev-research/behavioral-factories`
- `scripts/behavioral-factories.ts`
- lane-local grader and verifier surfaces when explicitly needed

Expected lane-local outputs may include:

- `dev-research/behavioral-factories/factories/`
- `dev-research/behavioral-factories/artifacts/`
- `dev-research/behavioral-factories/tests/`
- `dev-research/behavioral-factories/context/`
- `dev-research/behavioral-factories/memory/`

Do not write directly into:

- upstream seed or corpus lanes
- `src/behavioral`
- `src/ui`
- `src/server`
- `skills/`

unless a separate reviewed promotion step explicitly chooses to do so.

## Target Output Shape

This lane should produce deterministic, reviewable outputs such as:

- policy factory prototypes
- context pack schemas
- memory item schemas
- rollout and retry strategy artifacts
- validation rule sets
- retained artifact schemas
- training-ready summaries of successful behavioral and MSS patterns

These outputs may be represented as:

- markdown
- yaml
- json
- jsonl
- TypeScript
- archive bundles

They do not need to default to graph-heavy storage.

## Deterministic Contract

The runtime-facing result should be deterministic for the same inputs.

Deterministic responsibilities:

- preserve the dependency order from seed and corpus into factory outputs
- keep factory outputs stable and reviewable
- encode explicit provenance and retained-artifact structure
- validate behavioral and TypeScript seams

Autoresearch responsibilities:

- propose alternative factory decompositions
- compare memory and retrieval strategies
- compare simpler file-backed context approaches against heavier semantic ones
- judge promotion candidates across attempts

## Validation

Deterministic validation should be preferred for promotion decisions.

Expected checks include:

- `bun scripts/behavioral-factories.ts validate`
- `bun --bun tsc --noEmit` when TypeScript changes
- targeted tests for this lane’s script/test surface
- structural checks over generated behavioral code
- LSP-assisted checks for imports, symbol shape, and known anti-patterns

The lane should fail validation when:

- the program is missing or empty
- required upstream programs or artifacts are missing
- required runtime foundation surfaces are missing
- changed files leave the lane writable surface
- generated outputs cannot be traced back to inputs or retained artifacts

## Execution Contract

When run through autoresearch:

- use worktree-backed isolated attempts
- keep the main repo untouched during attempts
- write durable run artifacts while executing
- run deterministic validation before attempt completion
- prefer reviewable, lane-bounded outputs over broad speculative rewrites

`autoresearch-runner` owns:

- worktree creation
- attempt budgets
- parallel lane instances
- judging and promotion selection

This lane script owns:

- lane contract
- lane-local validation
- lane-local generation helpers

## Success Criteria

An attempt is stronger when it:

- preserves seed/corpus dependency order without reopening raw sources at runtime
- produces factory-oriented artifacts that are easy to inspect and mutate
- clarifies the unit of mutation for the evolving agent package
- improves retrieval, memory packing, rollout control, or validation in a
  concrete way
- makes behavioral programming and MSS easier for the model to internalize
- does not drift into unrelated framework rewrites

## Promotion

Promotion is separate from generation.

Validated attempts may be judged and selected, but the main repo should only
change through explicit promotion of an accepted attempt.
