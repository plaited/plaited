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
- `skills/mss/SKILL.md`
- `dev-research/default-hypergraph/seed/factory.jsonld`

Stable validator/support surfaces:

- `scripts/default-hypergraph.ts`
- `plaited skill-links`
- `src/tools/hypergraph.ts`

Program-owned writable artifacts should live under `dev-research/default-hypergraph/`.
Do not rewrite the stable root runner/validator scripts during fanout attempts.
Treat `src/tools/hypergraph.ts` as read-only support surface for this lane.

Expected future artifacts:

- `dev-research/default-hypergraph/schema/`
- `dev-research/default-hypergraph/seed/`
- `dev-research/default-hypergraph/tests/`
- `dev-research/default-hypergraph/scripts/`
- `dev-research/default-hypergraph/encodings/`
- `dev-research/default-hypergraph/provenance/`

## Required Coverage

The default graph should encode a significant portion of:

### Structural IA / MSS

- fixed MSS field names
- boundary
- scale
- relative scale
- structure as semantic lineage and generated realization
- mechanics as capability declarations and interaction semantics
- content type as alignment and translation surface
- valid and invalid combinations
- parent / child composition relationships
- modnet assembly semantics

The graph should treat these categories differently:

- `boundary` and `scale` are the strongest MSS invariants
- `contentType`, `structure`, and `mechanics` are more alignment-driven
- generated UI means `structure` is not a permanent shared template registry
- agent-to-agent querying means `contentType` and `mechanics` do not require global fixed-value equality
- older auto-grouping and auto-promotion rules should be represented as heuristics or tendencies, not universal laws

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

### Factory Compilation Surfaces

The graph explicitly marks which concepts are factory-compilable:

| Surface | Types | Compilable | Notes |
|---------|-------|------------|-------|
| `factory:surface/policy` | Policy, Trigger | Yes | Conditions, triggers, guards → behavioral rules |
| `factory:surface/rule` | Rule | Yes | If-then semantics → rule assertions |
| `factory:surface/thread-pattern` | Thread | Yes | bp:thread/* → bThread sequences |
| `factory:surface/constraint` | Constraint | Yes | Constraints → additive blocking bThreads |
| `factory:surface/graph-only` | Tag, Concept | No | Pure ontology, not policy-semantic |
| `factory:surface/provenance` | Example, Provenance | No | Validation material only |

Key factory policies:

- `factory:policy/graph-before-factory` — resolve graph concepts before compiling
- `factory:policy/preserve-invariants` — MSS invariants must survive compilation
- `factory:policy/traceable-output` — factory outputs traceable back to graph concepts

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

## Validation Tools

When an attempt changes TypeScript or validator-support files, it should use the
available repo tooling inside its worktree to assess the edit set.

Expected deterministic checks include:

- the stable program validator: `bun scripts/default-hypergraph.ts validate`
- `bun --bun tsc --noEmit` when TypeScript files change
- targeted tests for changed lane-local logic under `dev-research/default-hypergraph/tests/`
- Biome on touched TypeScript files when formatting or linting is relevant

Probabilistic assessment may still be used for synthesis, comparison, or
selection across attempts, but deterministic checks should be preferred for
promotion decisions.

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

- use worktree-backed isolated attempts
- each attempt must write durable observable artifacts while running
- each attempt must run deterministic validation before completion
- selection should prefer deterministic validation and changed-artifact quality
  over freeform model preference

The concrete agent harness, skill whitelist, and search/tooling surface are
runner concerns. This program should describe the ontology and evaluation
surface, not the specific operational wiring of Pi or search providers.

Lane-local helper scripts may be authored under
`dev-research/default-hypergraph/scripts/` to augment the stable validator
surface. They should not replace or override the root runner/validator entrypoint.

## Relationship To Behavioral Factories

This program owns the symbolic substrate.

It does not own runtime policy factories.
That belongs to `dev-research/behavioral-factories/program.md`.

The contract is:

- this program defines the graph and symbolic vocabulary
- behavioral factories consume that graph to produce runtime rules
- this program explicitly marks compilation surfaces (`factory:surface/*`)
- factories must preserve MSS invariants (`factory:policy/preserve-invariants`)

In particular:

- this program should encode the durable MSS invariants and agent-era reinterpretations
- it should distinguish hard constraints from soft heuristics
- it should preserve provenance where older Structural IA / Modnet theory is being reinterpreted for agents
- it should define which concepts are factory-compilable vs graph-only

### Compilation Chain

```
SKILL.md prose
    ↓ distillation (distill:* concepts)
graph artifacts (concepts, relations, provenance)
    ↓ factory compilation (factory:* surfaces)
behavioral factories (bThreads, guards, rules)
    ↓ runtime execution
agent behavior
```

## Long-Horizon Role

The long-horizon evolutionary loop should mutate and evaluate candidates around
this graph, but the default graph itself should remain a stable baseline that
can be validated and inspected independently.
