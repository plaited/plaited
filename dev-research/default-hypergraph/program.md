# Default Hypergraph Program

## Purpose

Build the canonical symbolic substrate for the agent.

This program defines the default hypergraph that should exist before any
evolutionary or autoresearch loop begins mutating behavior. The graph is the
deterministic knowledge layer for:

- Structural IA concepts
- MSS / modnet concepts
- agent tool and sensor concepts
- retrieval and search triggers
- uncertainty and evidence concepts
- decomposition and coordination concepts

The goal is not prose storage. The goal is a queryable symbolic graph that can
be consumed by runtime tooling and behavioral factories.

This program also defines the **encoding method** by which skill and document
knowledge should be distilled into that graph. It is not enough to hand-author
seed vertices forever. This lane should discover and validate how prose assets
like `SKILL.md` files, references, and research docs become reliable symbolic
artifacts.

## Why This Exists

Small local models will not reliably infer the right concepts on their own.
They need the right symbolic substrate and the right tools.

This program creates the default graph that encodes:

- what the agent knows
- what the agent can sense
- when search or retrieval is required
- how modnet / MSS concepts relate to runtime behavior

It also exists to answer:

- what parts of a skill are stable enough to encode directly
- what parts belong in the graph vs behavioral factories
- what should remain commentary or examples instead of ontology
- how to make skill knowledge less dependent on nondeterministic invocation

## Deterministic Boundary

This program is deterministic at the core.

Deterministic responsibilities:

- define graph schema expectations
- define canonical vertex and hyperedge classes
- define the default seed graph
- define the encoding contract from skills/docs into graph artifacts
- define what is directly encodable, inferred, or rejected as too vague
- define coverage expectations
- validate graph integrity and coverage

Generative responsibilities belong outside this core:

- propose new vertices or hyperedges
- propose graph mutations
- propose alternative symbolic decompositions
- propose alternative encodings of the same skill knowledge

Those generative proposals may later be evaluated against this program, but they
should not replace the deterministic default graph.

## Core Artifacts

The main research artifacts for this program are:

- `dev-research/default-hypergraph/program.md`
- `src/tools/hypergraph.ts`
- `scripts/default-hypergraph.ts`
- `plaited skill-links`
- `skills/hypergraph-memory/SKILL.md`
- `skills/behavioral-core/SKILL.md`
- `skills/mss-vocabulary/SKILL.md`

Expected future artifacts:

- `dev-research/default-hypergraph/schema/`
- `dev-research/default-hypergraph/seed/`
- `dev-research/default-hypergraph/tests/`
- `dev-research/default-hypergraph/encodings/`
- `dev-research/default-hypergraph/provenance/`

## Required Coverage

The default graph should encode a significant portion of:

### Structural IA / MSS

- scale
- relative scale
- structure
- mechanics
- boundary
- content type
- valid and invalid combinations
- parent / child composition relationships
- modnet assembly semantics

### Agent Knowledge

- uncertainty
- evidence required
- retrieval needed
- web search needed
- local tool sufficient
- ask human required
- stop / do not continue

### Runtime Coordination

- decomposition patterns
- fanout / batch search
- merge / selection
- safety and boundary constraints
- memory usefulness and recall triggers
- when symbolic state should be preferred over raw recall

### Skill Distillation Contract

- skill sections that define stable concepts
- skill sections that define stable relations
- skill sections that define executable policy patterns
- examples and counterexamples as provenance, not ontology
- markdown link structure as optional relationship hints
- explicit boundaries between ontology, factories, and commentary

## Encoding Contract

This program should gradually define a repeatable way to encode a skill or doc
into graph artifacts.

The target is not “ingest markdown literally.” The target is to extract durable
symbolic structure.

Encoding should separate:

- **ontology**
  - concepts, classes, relations, invariants
- **factory-facing policy knowledge**
  - conditions, triggers, guard logic, decomposition patterns
- **examples and traces**
  - useful as provenance and validation material
- **commentary**
  - rationale that should stay human-readable but not become ontology

Minimum expected encoding outputs:

- normalized concept IDs
- typed relations
- provenance links back to source sections
- validation targets for required concepts and links

Optional encoding support may include:

- markdown link extraction from `SKILL.md` and referenced docs
- normalized relationship hints such as:
  - `references`
  - `setupFor`
  - `examples`
  - `dependsOn`

These hints are useful input, but they are not the ontology by themselves.

## Evaluation

The main evaluation surface is deterministic:

- graph files parse
- schema constraints hold
- required concepts exist
- required links exist
- key reachability paths resolve
- graph queries return expected symbolic neighborhoods
- encoded skill outputs preserve required concepts and relations
- provenance links resolve back to real source sections

Good outer-loop metrics later include:

- better search invocation decisions
- fewer unsupported claims
- better decomposition choices
- improved harness behavior under deterministic task suites

## Authoring Outcome

What we learn here should be usable to author a future reusable skill or
program for symbolic distillation.

That future skill/program should help an agent:

- read a `SKILL.md`
- extract stable symbolic concepts
- distinguish ontology from examples and commentary
- emit graph artifacts and validation targets
- reduce runtime dependence on raw skill invocation

This program is where that method should first be discovered and hardened.

## Execution Contract

When this program is executed through autoresearch or fanout:

- use one `git worktree` per attempt
- each attempt must write durable artifacts while running
- each attempt must run deterministic validation before completion
- selection should prefer deterministic validation and changed-artifact quality
  over freeform model preference

Minimum per-attempt artifacts:

- `status.json`
- `result.json`
- `stdout.log`
- `stderr.log`
- validation stdout / stderr logs
- diff summary

The runner may use Pi as the agent harness, but it should:

- disable automatic skill discovery
- pass only an explicit skill whitelist
- run in the attempt worktree as `cwd`
- preserve the worktree for inspection after the attempt finishes

Recommended skill whitelist for this program:

- `skills/hypergraph-memory`
- `skills/mss-vocabulary`
- `skills/behavioral-core`

## Relationship To Behavioral Factories

This program owns the symbolic substrate.

It does not own runtime policy factories.
That belongs to `dev-research/behavioral-factories/program.md`.

The contract is:

- this program defines the graph and symbolic vocabulary
- behavioral factories consume that graph to produce runtime rules

## Long-Horizon Role

The long-horizon evolutionary loop should mutate and evaluate candidates around
this graph, but the default graph itself should remain a stable baseline that
can be validated and inspected independently.
