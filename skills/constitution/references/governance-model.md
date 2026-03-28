# Governance Model

This reference describes the governance-layer rationale behind the
constitution. Use it when the agent needs the architectural model for why the
constitution exists, how it composes with behavioral programming, and where
different control layers apply.

## Neuro-Symbolic Split

The constitution is intentionally dual-layered.

Small and medium models cannot be relied on to internalize every constraint
through training alone. Plaited therefore uses:

- a **symbolic layer** at runtime for deterministic enforcement
- a **neural layer** for context assembly and understanding

Constitutional knowledge splits across two mechanisms:

| Kind | Mechanism | Pipeline Stage |
|------|-----------|---------------|
| Structural / syntactic | `block` predicates in bThreads | Gate (synchronous) |
| Contextual / semantic | Async handlers -> inference calls | Simulate -> Evaluate (async) |

The symbolic layer catches what the model misses. The neural layer reduces
wasted inference by teaching the model what is blocked. Neither alone is
sufficient.

## Access Control: MAC / DAC / ABAC

Three access-control models compose to form the governance stack.

### MAC

**Mandatory Access Control** is framework-provided and immutable at runtime.
The agent cannot override or remove it.

Examples:
- `noRmRf`
- `protectGovernance`

### DAC

**Discretionary Access Control** is agent-generated from user desired outcomes.
Users can add, modify, or remove these rules with approval.

Examples:
- `noProductionDeploys`
- `requireReviewBeforeMerge`

### ABAC

**Attribute-Based Access Control** operates at event routing rather than the
factory layer. Risk tags determine how events are handled.

Examples:
- `workspace`
- `crosses_boundary`
- `inbound`
- `outbound`
- `irreversible`
- `external_audience`

Empty or unknown tags should route to simulation + judgment. Workspace-only
events can execute directly.

MAC and DAC share the same factory contract. The distinction is lifecycle, not
shape. ABAC operates at the routing layer.

## Dual Representation

Constitution rules exist in two forms simultaneously:

| Layer | Mechanism | What It Does |
|-------|-----------|-------------|
| bThread (symbolic) | Block predicates | Prevents dangerous events structurally |
| Context / teaching surface | Skill text, memory, or training context | Teaches the model the rules |

Both are needed and non-substitutable:

- bThread alone: the model keeps proposing blocked actions, wasting inference
- context alone: the model may find creative circumventions
- both: the model understands the rules and the engine still enforces them

Skills are one current bootstrap surface for that context, but they should not be
treated as the final home of governance knowledge. Constitution understanding
should increasingly also live in durable memory and training substrates.

Constitution skills should remain area-of-effect scoped rather than globally
injecting every rule at all times.

## Ratchet Principle

The constitution is additive and append-only.

- new factories can be added
- existing MAC factories cannot be removed or weakened
- DAC rules remain user-controlled and are exempt from the MAC ratchet

This is enforced structurally by governance protection mechanisms such as
`protectGovernance`.

The point of the ratchet is that safety guarantees should only grow over time.
A system that has learned to avoid a class of failures should not silently
unlearn that constraint.

## Relationship to MSS and Plaited Core

The constitution is not separate from Plaited's broader architecture.

- behavioral programming provides the enforcement substrate
- governance factories provide constitutional constraints
- MSS and hypergraph memory provide structured semantic surfaces

Long term, constitution concepts should be available not only as raw skills,
but also through durable seed and corpus memory, just as MSS is moving toward
seed and corpus lanes.
